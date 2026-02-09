-- Add status field to handle requested sessions
-- The module_sessions table already has a status column, so we just need to add 'requested' as a valid status
-- Also add a 'requested_by' column to track who requested the session

ALTER TABLE module_sessions 
ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS request_message text;

-- Create index for finding pending requests
CREATE INDEX IF NOT EXISTS idx_module_sessions_status ON module_sessions(status);
CREATE INDEX IF NOT EXISTS idx_module_sessions_requested_by ON module_sessions(requested_by);

-- Update RLS to allow clients to create session requests
DROP POLICY IF EXISTS "Clients can request sessions" ON module_sessions;
CREATE POLICY "Clients can request sessions" ON module_sessions
FOR INSERT TO authenticated
WITH CHECK (
  status = 'requested' 
  AND requested_by = auth.uid()
  AND (
    -- Individual request: client must be enrolled in the program the module belongs to
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      JOIN program_modules pm ON pm.program_id = ce.program_id
      WHERE pm.id = module_id
      AND ce.client_user_id = auth.uid()
      AND ce.status = 'active'
    )
  )
);

-- Allow clients to view their own session requests
DROP POLICY IF EXISTS "Clients can view their sessions" ON module_sessions;
CREATE POLICY "Clients can view their sessions" ON module_sessions
FOR SELECT TO authenticated
USING (
  -- Client can see their individual sessions
  enrollment_id IN (SELECT id FROM client_enrollments WHERE client_user_id = auth.uid())
  OR
  -- Or group sessions they are a participant of
  id IN (SELECT session_id FROM module_session_participants WHERE user_id = auth.uid())
  OR
  -- Or their own session requests
  requested_by = auth.uid()
);