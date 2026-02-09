-- Allow clients to insert their own scenario assignments
CREATE POLICY "Clients can create own assignments"
ON public.scenario_assignments
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());