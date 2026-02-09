-- Add is_published column to resource_library
ALTER TABLE public.resource_library
ADD COLUMN is_published boolean NOT NULL DEFAULT false;

-- Drop existing view policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view active resources" ON public.resource_library;

-- Create new policy: only show published resources to non-admins
CREATE POLICY "Authenticated users can view published resources"
ON public.resource_library
FOR SELECT
USING (
  (is_active = true AND is_published = true AND auth.uid() IS NOT NULL)
  OR has_role(auth.uid(), 'admin')
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_resource_library_published ON public.resource_library(is_published) WHERE is_published = true;