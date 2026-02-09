-- Add flag to program_modules to indicate individualized content
ALTER TABLE public.program_modules 
ADD COLUMN is_individualized boolean NOT NULL DEFAULT false;

-- Create table for client-specific module content
CREATE TABLE public.module_client_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(module_id, user_id)
);

-- Create table for attachments to client content
CREATE TABLE public.module_client_content_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_client_content_id uuid NOT NULL REFERENCES public.module_client_content(id) ON DELETE CASCADE,
  title text NOT NULL,
  attachment_type text NOT NULL, -- 'file', 'link', 'image'
  file_path text,
  url text,
  description text,
  mime_type text,
  file_size integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create storage bucket for client content files
INSERT INTO storage.buckets (id, name, public)
VALUES ('module-client-content', 'module-client-content', false);

-- Enable RLS
ALTER TABLE public.module_client_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_client_content_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for module_client_content
-- Admins can manage all
CREATE POLICY "Admins can manage all client content"
ON public.module_client_content FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors/coaches can manage content for their assigned programs
CREATE POLICY "Instructors can manage content for their program modules"
ON public.module_client_content FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE pm.id = module_client_content.module_id
    AND pi.instructor_id = auth.uid()
  )
);

CREATE POLICY "Coaches can manage content for their program modules"
ON public.module_client_content FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE pm.id = module_client_content.module_id
    AND pc.coach_id = auth.uid()
  )
);

-- Clients can view their own assigned content
CREATE POLICY "Clients can view their own assigned content"
ON public.module_client_content FOR SELECT
USING (auth.uid() = user_id);

-- RLS for module_client_content_attachments
CREATE POLICY "Admins can manage all attachments"
ON public.module_client_content_attachments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can manage attachments for their program modules"
ON public.module_client_content_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM module_client_content mcc
    JOIN program_modules pm ON pm.id = mcc.module_id
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE mcc.id = module_client_content_attachments.module_client_content_id
    AND pi.instructor_id = auth.uid()
  )
);

CREATE POLICY "Coaches can manage attachments for their program modules"
ON public.module_client_content_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM module_client_content mcc
    JOIN program_modules pm ON pm.id = mcc.module_id
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE mcc.id = module_client_content_attachments.module_client_content_id
    AND pc.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can view attachments for their content"
ON public.module_client_content_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_client_content mcc
    WHERE mcc.id = module_client_content_attachments.module_client_content_id
    AND mcc.user_id = auth.uid()
  )
);

-- Storage policies for module-client-content bucket
CREATE POLICY "Admins can manage all files"
ON storage.objects FOR ALL
USING (bucket_id = 'module-client-content' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-client-content' AND has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Coaches can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-client-content' AND has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Users can view their own content files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'module-client-content' 
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'instructor'::app_role)
    OR has_role(auth.uid(), 'coach'::app_role)
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_module_client_content_updated_at
BEFORE UPDATE ON public.module_client_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();