-- G4: Attendance Tracking — table, indexes, RLS, trigger

CREATE TABLE public.cohort_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cohort_sessions(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused')),
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, enrollment_id)
);

-- Indexes
CREATE INDEX idx_attendance_session_id ON public.cohort_session_attendance(session_id);
CREATE INDEX idx_attendance_enrollment_id ON public.cohort_session_attendance(enrollment_id);

-- Enable RLS
ALTER TABLE public.cohort_session_attendance ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins can manage attendance"
  ON public.cohort_session_attendance
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Instructors: full access for sessions in their programs
CREATE POLICY "Instructors can manage attendance for their sessions"
  ON public.cohort_session_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_sessions cs
      JOIN public.program_cohorts pc ON pc.id = cs.cohort_id
      JOIN public.program_instructors pi ON pi.program_id = pc.program_id
      WHERE cs.id = cohort_session_attendance.session_id
        AND pi.instructor_id = auth.uid()
    )
  );

-- Coaches: read-only for sessions in their programs
CREATE POLICY "Coaches can view attendance for their programs"
  ON public.cohort_session_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cohort_sessions cs
      JOIN public.program_cohorts pc ON pc.id = cs.cohort_id
      JOIN public.program_coaches pco ON pco.program_id = pc.program_id
      WHERE cs.id = cohort_session_attendance.session_id
        AND pco.coach_id = auth.uid()
    )
  );

-- Clients: can see own attendance only
CREATE POLICY "Clients can view own attendance"
  ON public.cohort_session_attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      WHERE ce.id = cohort_session_attendance.enrollment_id
        AND ce.client_user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE TRIGGER update_cohort_session_attendance_updated_at
  BEFORE UPDATE ON public.cohort_session_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
