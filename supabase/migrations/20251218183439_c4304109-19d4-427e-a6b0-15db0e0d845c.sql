-- Update RLS policies for module_resource_assignments to include coaches

-- Drop existing instructor policy
DROP POLICY IF EXISTS "Instructors can manage assignments for their modules" ON public.module_resource_assignments;

-- Create new policy that includes instructors AND coaches
CREATE POLICY "Instructors and coaches can manage assignments"
ON public.module_resource_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE pm.id = module_resource_assignments.module_id
    AND pi.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE pm.id = module_resource_assignments.module_id
    AND pc.coach_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE pm.id = module_resource_assignments.module_id
    AND pi.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE pm.id = module_resource_assignments.module_id
    AND pc.coach_id = auth.uid()
  )
);