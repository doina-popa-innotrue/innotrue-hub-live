-- Create module_sessions table for linking sessions to modules
CREATE TABLE public.module_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  session_date TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  booked_by UUID REFERENCES auth.users(id),
  instructor_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT module_sessions_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled'))
);

-- Create unique constraint to prevent duplicate sessions for same module/enrollment
CREATE UNIQUE INDEX module_sessions_unique_enrollment ON public.module_sessions(module_id, enrollment_id) WHERE status != 'cancelled';

-- Enable RLS
ALTER TABLE public.module_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all module sessions
CREATE POLICY "Admins can manage all module sessions"
  ON public.module_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view their own module sessions
CREATE POLICY "Clients can view their own module sessions"
  ON public.module_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_enrollments ce
      WHERE ce.id = module_sessions.enrollment_id
      AND ce.client_user_id = auth.uid()
    )
  );

-- Instructors can manage sessions for modules they're assigned to
CREATE POLICY "Instructors can manage sessions for their modules"
  ON public.module_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM module_instructors mi
      WHERE mi.module_id = module_sessions.module_id
      AND mi.instructor_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM module_coaches mc
      WHERE mc.module_id = module_sessions.module_id
      AND mc.coach_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_module_sessions_updated_at
  BEFORE UPDATE ON public.module_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();