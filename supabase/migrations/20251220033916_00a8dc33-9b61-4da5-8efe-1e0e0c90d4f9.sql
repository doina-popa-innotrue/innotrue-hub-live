-- Create module prerequisites table
CREATE TABLE public.module_prerequisites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  prerequisite_module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_id, prerequisite_module_id),
  CONSTRAINT no_self_reference CHECK (module_id != prerequisite_module_id)
);

-- Enable RLS
ALTER TABLE public.module_prerequisites ENABLE ROW LEVEL SECURITY;

-- Admins can manage prerequisites
CREATE POLICY "Admins can manage prerequisites"
ON public.module_prerequisites
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view prerequisites
CREATE POLICY "Authenticated users can view prerequisites"
ON public.module_prerequisites
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add index for faster lookups
CREATE INDEX idx_module_prerequisites_module_id ON public.module_prerequisites(module_id);
CREATE INDEX idx_module_prerequisites_prerequisite_id ON public.module_prerequisites(prerequisite_module_id);