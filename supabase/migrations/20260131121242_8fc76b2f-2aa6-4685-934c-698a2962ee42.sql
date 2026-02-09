-- Drop the overly permissive policy and replace with a more targeted one
DROP POLICY IF EXISTS "Authenticated users can view instructor event types for booking" ON public.instructor_calcom_event_types;

-- Clients can view instructor event types for instructors assigned to their enrollments
CREATE POLICY "Clients can view event types for their assigned instructors"
ON public.instructor_calcom_event_types
FOR SELECT
TO authenticated
USING (
    -- Can view if the instructor is assigned to any module in their enrollment
    EXISTS (
        SELECT 1 FROM public.enrollment_module_staff ems
        JOIN public.client_enrollments ce ON ce.id = ems.enrollment_id
        WHERE ce.client_user_id = auth.uid()
        AND (ems.instructor_id = instructor_calcom_event_types.instructor_id 
             OR ems.coach_id = instructor_calcom_event_types.instructor_id)
    )
    OR
    -- Or if instructor is assigned at module level for their program
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_modules pm ON pm.program_id = ce.program_id
        JOIN public.module_instructors mi ON mi.module_id = pm.id
        WHERE ce.client_user_id = auth.uid()
        AND mi.instructor_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Or if instructor is assigned at program level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_instructors pi ON pi.program_id = ce.program_id
        WHERE ce.client_user_id = auth.uid()
        AND pi.instructor_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Coaches at module level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_modules pm ON pm.program_id = ce.program_id
        JOIN public.module_coaches mc ON mc.module_id = pm.id
        WHERE ce.client_user_id = auth.uid()
        AND mc.coach_id = instructor_calcom_event_types.instructor_id
    )
    OR
    -- Coaches at program level
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        JOIN public.program_coaches pc ON pc.program_id = ce.program_id
        WHERE ce.client_user_id = auth.uid()
        AND pc.coach_id = instructor_calcom_event_types.instructor_id
    )
);