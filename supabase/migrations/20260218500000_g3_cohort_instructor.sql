-- G3: Add instructor assignment to cohorts and sessions
-- Cohort gets a "lead instructor" — sessions inherit by default,
-- but can override with a different instructor per-session.

ALTER TABLE public.program_cohorts
  ADD COLUMN lead_instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cohort_sessions
  ADD COLUMN instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
