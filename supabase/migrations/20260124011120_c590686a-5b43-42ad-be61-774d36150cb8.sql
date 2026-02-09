-- Fix instructor policy that incorrectly uses shared_with_coach instead of shared_with_instructor
-- This was allowing instructors to see assessments only when shared_with_coach was true (wrong flag)

DROP POLICY IF EXISTS "Assigned instructors can view shared non-private assessments" ON public.capability_snapshots;

CREATE POLICY "Assigned instructors can view shared non-private assessments" 
ON public.capability_snapshots 
FOR SELECT 
USING (
    -- Must not be private
    is_private = false 
    -- Must be explicitly shared with instructor (FIXED: was incorrectly checking shared_with_coach)
    AND shared_with_instructor = true 
    -- Instructor must be assigned to this client
    AND EXISTS (
        SELECT 1 FROM client_instructors ci
        WHERE ci.instructor_id = auth.uid() 
        AND ci.client_id = capability_snapshots.user_id
    )
);