-- Create junction table for resource-program relationships
CREATE TABLE public.resource_library_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resource_id, program_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_resource_library_programs_resource ON public.resource_library_programs(resource_id);
CREATE INDEX idx_resource_library_programs_program ON public.resource_library_programs(program_id);

-- Enable RLS
ALTER TABLE public.resource_library_programs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all resource-program links
CREATE POLICY "Admins can manage resource program links"
ON public.resource_library_programs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view links for resources they have access to
CREATE POLICY "Users can view resource program links"
ON public.resource_library_programs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.resource_library r
    WHERE r.id = resource_id
    AND (
      r.is_published = true
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);