-- Add content_package_path to program_modules for Rise web content embed
-- When set, the module's content is served from the module-content-packages storage bucket
-- via the serve-content-package edge function (auth-gated proxy)
ALTER TABLE public.program_modules
ADD COLUMN IF NOT EXISTS content_package_path TEXT DEFAULT NULL;

COMMENT ON COLUMN public.program_modules.content_package_path IS
  'Storage path prefix in module-content-packages bucket for extracted Rise/web content package';

-- Create private storage bucket for Rise content packages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'module-content-packages',
  'module-content-packages',
  false,      -- Private: assets served through serve-content-package edge function
  524288000,  -- 500 MB limit per file
  NULL        -- Allow all MIME types (HTML, CSS, JS, images, fonts, video, audio)
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Only admins can manage content packages
CREATE POLICY "Admins can manage content packages"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'module-content-packages'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'module-content-packages'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
