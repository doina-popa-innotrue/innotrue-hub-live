-- Add is_active column to program_modules table
ALTER TABLE public.program_modules
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add index for better query performance
CREATE INDEX idx_program_modules_is_active ON public.program_modules(is_active);

-- Update RLS policy to filter inactive modules for clients
DROP POLICY IF EXISTS "Users can view modules of programs they're enrolled in or admin" ON public.program_modules;

CREATE POLICY "Users can view modules of programs they're enrolled in or admin"
ON public.program_modules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (
    is_active = true AND
    EXISTS (
      SELECT 1
      FROM client_enrollments
      WHERE client_enrollments.client_user_id = auth.uid() 
      AND client_enrollments.program_id = program_modules.program_id
    )
  )
);

-- Update RLS policy for programs to filter inactive ones for clients
DROP POLICY IF EXISTS "Users can view programs they are enrolled in" ON public.programs;

CREATE POLICY "Users can view programs they are enrolled in"
ON public.programs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (
    is_active = true AND
    EXISTS (
      SELECT 1
      FROM client_enrollments
      WHERE client_enrollments.program_id = programs.id 
      AND client_enrollments.client_user_id = auth.uid()
    )
  )
);