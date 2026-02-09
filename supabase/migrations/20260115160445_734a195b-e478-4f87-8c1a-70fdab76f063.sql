-- First, drop existing staff notes policies
DROP POLICY IF EXISTS "Staff can view client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can add client notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Authors can update own notes" ON public.client_staff_notes;
DROP POLICY IF EXISTS "Staff can delete own notes" ON public.client_staff_notes;

-- Create comprehensive function to check if staff has ANY valid relationship with client
CREATE OR REPLACE FUNCTION public.staff_has_client_relationship(_staff_id uuid, _client_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- 1. Direct coach assignment to client
    EXISTS (
      SELECT 1 FROM client_coaches
      WHERE coach_id = _staff_id AND client_id = _client_user_id
    )
    OR
    -- 2. Program instructor for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_instructors pi
      JOIN client_enrollments ce ON ce.program_id = pi.program_id
      WHERE pi.instructor_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 3. Program coach for any of client's enrolled programs
    EXISTS (
      SELECT 1 FROM program_coaches pc
      JOIN client_enrollments ce ON ce.program_id = pc.program_id
      WHERE pc.coach_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 4. Module instructor for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_instructors mi
      JOIN program_modules pm ON pm.id = mi.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mi.instructor_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
    OR
    -- 5. Module coach for any module in client's enrolled programs
    EXISTS (
      SELECT 1 FROM module_coaches mc
      JOIN program_modules pm ON pm.id = mc.module_id
      JOIN client_enrollments ce ON ce.program_id = pm.program_id
      WHERE mc.coach_id = _staff_id 
        AND ce.client_user_id = _client_user_id
    )
$$;

-- Create new RLS policies for client_staff_notes

-- SELECT: Admins can view all, staff can view notes for their related clients
CREATE POLICY "Staff can view client notes"
ON public.client_staff_notes
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.staff_has_client_relationship(auth.uid(), client_user_id)
);

-- INSERT: Admins can always insert, staff only for related clients
CREATE POLICY "Staff can add client notes"
ON public.client_staff_notes
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.staff_has_client_relationship(auth.uid(), client_user_id)
);

-- UPDATE: Only note authors can update their own notes
CREATE POLICY "Authors can update own notes"
ON public.client_staff_notes
FOR UPDATE
USING (author_id = auth.uid());

-- DELETE: Only note authors can delete, OR admins can delete any
CREATE POLICY "Staff can delete notes"
ON public.client_staff_notes
FOR DELETE
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);