-- Add session_type and program_id to support both individual and group sessions
ALTER TABLE public.module_sessions
  ADD COLUMN session_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

-- Make enrollment_id nullable (required for individual, null for group)
ALTER TABLE public.module_sessions
  ALTER COLUMN enrollment_id DROP NOT NULL;

-- Add constraint to ensure proper data based on session type
ALTER TABLE public.module_sessions
  ADD CONSTRAINT module_sessions_type_check 
  CHECK (
    (session_type = 'individual' AND enrollment_id IS NOT NULL) OR
    (session_type = 'group' AND program_id IS NOT NULL)
  );

-- Drop the old unique index and create new ones for each session type
DROP INDEX IF EXISTS module_sessions_unique_enrollment;

-- Unique individual session per module/enrollment
CREATE UNIQUE INDEX module_sessions_unique_individual 
  ON public.module_sessions(module_id, enrollment_id) 
  WHERE session_type = 'individual' AND status != 'cancelled';

-- Allow multiple group sessions per module/program (no unique constraint needed)

-- Add RLS policy for group sessions - clients can view group sessions for their enrolled programs
CREATE POLICY "Clients can view group sessions for their programs"
  ON public.module_sessions FOR SELECT
  USING (
    session_type = 'group' AND
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      WHERE ce.program_id = module_sessions.program_id
      AND ce.client_user_id = auth.uid()
    )
  );