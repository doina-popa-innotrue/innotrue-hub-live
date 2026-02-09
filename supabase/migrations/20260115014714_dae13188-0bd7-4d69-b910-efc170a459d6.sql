-- Create program_cohorts table
CREATE TABLE public.program_cohorts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cohort_sessions table
CREATE TABLE public.cohort_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.program_cohorts(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.program_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  meeting_link TEXT,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add cohort_id to client_enrollments
ALTER TABLE public.client_enrollments
ADD COLUMN cohort_id UUID REFERENCES public.program_cohorts(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.program_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for program_cohorts using has_role function
CREATE POLICY "Admins can manage cohorts"
ON public.program_cohorts
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view cohorts for their programs"
ON public.program_cohorts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.program_instructors pi
    WHERE pi.program_id = program_cohorts.program_id
    AND pi.instructor_id = auth.uid()
  )
);

CREATE POLICY "Clients can view cohorts they are enrolled in"
ON public.program_cohorts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.client_enrollments ce
    WHERE ce.cohort_id = program_cohorts.id
    AND ce.client_user_id = auth.uid()
  )
);

-- RLS policies for cohort_sessions
CREATE POLICY "Admins can manage cohort sessions"
ON public.cohort_sessions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors can view sessions for their cohorts"
ON public.cohort_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.program_cohorts pc
    JOIN public.program_instructors pi ON pi.program_id = pc.program_id
    WHERE pc.id = cohort_sessions.cohort_id
    AND pi.instructor_id = auth.uid()
  )
);

CREATE POLICY "Clients can view sessions for their enrolled cohorts"
ON public.cohort_sessions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.client_enrollments ce
    WHERE ce.cohort_id = cohort_sessions.cohort_id
    AND ce.client_user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_program_cohorts_program_id ON public.program_cohorts(program_id);
CREATE INDEX idx_program_cohorts_status ON public.program_cohorts(status);
CREATE INDEX idx_cohort_sessions_cohort_id ON public.cohort_sessions(cohort_id);
CREATE INDEX idx_cohort_sessions_session_date ON public.cohort_sessions(session_date);
CREATE INDEX idx_client_enrollments_cohort_id ON public.client_enrollments(cohort_id);

-- Create triggers for updated_at
CREATE TRIGGER update_program_cohorts_updated_at
BEFORE UPDATE ON public.program_cohorts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cohort_sessions_updated_at
BEFORE UPDATE ON public.cohort_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();