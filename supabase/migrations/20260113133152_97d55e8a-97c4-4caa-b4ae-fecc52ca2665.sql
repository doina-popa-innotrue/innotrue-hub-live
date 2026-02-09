-- Fix infinite recursion between module_sessions and module_session_participants RLS

-- Helper: check whether a user can manage a given session (runs as definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.can_manage_module_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.module_sessions ms
    WHERE ms.id = _session_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR (ms.instructor_id = _user_id)
        OR EXISTS (
          SELECT 1 FROM public.module_instructors mi
          WHERE mi.module_id = ms.module_id AND mi.instructor_id = _user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.module_coaches mc
          WHERE mc.module_id = ms.module_id AND mc.coach_id = _user_id
        )
        OR public.is_program_instructor_or_coach(_user_id, COALESCE(ms.program_id, public.get_program_id_from_module(ms.module_id)))
      )
  );
$$;

-- Replace the recursive policy on module_session_participants
DROP POLICY IF EXISTS "Instructors can manage participants for their modules" ON public.module_session_participants;

CREATE POLICY "Instructors can manage participants for their modules"
ON public.module_session_participants
FOR ALL
USING (
  public.can_manage_module_session(auth.uid(), module_session_participants.session_id)
)
WITH CHECK (
  public.can_manage_module_session(auth.uid(), module_session_participants.session_id)
);
