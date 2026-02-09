-- Create program versions table to track program history
CREATE TABLE public.program_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_current BOOLEAN DEFAULT false,
  snapshot_data JSONB NOT NULL,
  UNIQUE(program_id, version_number)
);

-- Create program module versions table to store module snapshots
CREATE TABLE public.program_module_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.program_versions(id) ON DELETE CASCADE,
  original_module_id UUID REFERENCES public.program_modules(id) ON DELETE SET NULL,
  module_snapshot JSONB NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add program_version_id to client_enrollments to track which version each enrollment uses
ALTER TABLE public.client_enrollments 
ADD COLUMN program_version_id UUID REFERENCES public.program_versions(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_module_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for program_versions
CREATE POLICY "Admins can manage all program versions"
ON public.program_versions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view versions of programs they're enrolled in"
ON public.program_versions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.client_enrollments
    WHERE client_enrollments.client_user_id = auth.uid()
    AND client_enrollments.program_id = program_versions.program_id
  )
);

-- RLS policies for program_module_versions
CREATE POLICY "Admins can manage all module versions"
ON public.program_module_versions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view module versions they're enrolled in"
ON public.program_module_versions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 
    FROM public.program_versions pv
    JOIN public.client_enrollments ce ON ce.program_id = pv.program_id
    WHERE pv.id = program_module_versions.version_id
    AND ce.client_user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_program_versions_program_id ON public.program_versions(program_id);
CREATE INDEX idx_program_versions_is_current ON public.program_versions(program_id, is_current);
CREATE INDEX idx_program_module_versions_version_id ON public.program_module_versions(version_id);
CREATE INDEX idx_client_enrollments_version_id ON public.client_enrollments(program_version_id);

-- Create function to automatically create initial version when program is created
CREATE OR REPLACE FUNCTION public.create_initial_program_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_version_id UUID;
BEGIN
  -- Create initial version
  INSERT INTO public.program_versions (
    program_id,
    version_number,
    version_name,
    created_by,
    is_current,
    snapshot_data
  ) VALUES (
    NEW.id,
    1,
    'Initial Version',
    auth.uid(),
    true,
    jsonb_build_object(
      'name', NEW.name,
      'description', NEW.description,
      'category', NEW.category,
      'is_active', NEW.is_active,
      'slug', NEW.slug
    )
  ) RETURNING id INTO new_version_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create initial version
CREATE TRIGGER trigger_create_initial_program_version
AFTER INSERT ON public.programs
FOR EACH ROW
EXECUTE FUNCTION public.create_initial_program_version();