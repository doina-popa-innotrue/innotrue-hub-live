-- Resource Library - Reusable resources with canonical IDs
CREATE TABLE public.resource_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT NOT NULL UNIQUE, -- User-defined external ID for integration
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'link', -- link, file, video, document, presentation, etc.
  url TEXT, -- For external links/resources
  file_path TEXT, -- For uploaded files (storage bucket)
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}', -- Additional info (duration, author, source, tags, etc.)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Module Resource Assignments - Links resources to modules
CREATE TABLE public.module_resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false, -- Whether this resource is required for module completion
  notes TEXT, -- Optional notes specific to this assignment
  assigned_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, resource_id) -- Prevent duplicate assignments
);

-- Enable RLS
ALTER TABLE public.resource_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_resource_assignments ENABLE ROW LEVEL SECURITY;

-- RLS for resource_library
CREATE POLICY "Admins can manage all resources"
  ON public.resource_library FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active resources"
  ON public.resource_library FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS for module_resource_assignments
CREATE POLICY "Admins can manage all resource assignments"
  ON public.module_resource_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view assignments for accessible modules"
  ON public.module_resource_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN programs p ON p.id = pm.program_id
      WHERE pm.id = module_resource_assignments.module_id
      AND (p.is_active = true OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Instructors can manage assignments for their modules
CREATE POLICY "Instructors can manage resource assignments for their modules"
  ON public.module_resource_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM module_instructors mi
      WHERE mi.module_id = module_resource_assignments.module_id
      AND mi.instructor_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_resource_library_canonical_id ON public.resource_library(canonical_id);
CREATE INDEX idx_resource_library_type ON public.resource_library(resource_type);
CREATE INDEX idx_resource_library_active ON public.resource_library(is_active);
CREATE INDEX idx_module_resource_assignments_module ON public.module_resource_assignments(module_id);
CREATE INDEX idx_module_resource_assignments_resource ON public.module_resource_assignments(resource_id);

-- Trigger for updated_at
CREATE TRIGGER update_resource_library_updated_at
  BEFORE UPDATE ON public.resource_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resource library files
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-library', 'resource-library', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resource-library bucket
CREATE POLICY "Admins can manage resource library files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'resource-library' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view resource library files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resource-library' AND auth.uid() IS NOT NULL);