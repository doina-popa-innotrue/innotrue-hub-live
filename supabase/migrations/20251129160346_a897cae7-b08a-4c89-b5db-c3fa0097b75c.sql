-- Step 2: Create module_types table for global module types
CREATE TABLE public.module_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default module types
INSERT INTO public.module_types (name, description) VALUES
  ('session', 'Live session or workshop'),
  ('assignment', 'Assignment or task'),
  ('reflection', 'Reflection exercise'),
  ('resource', 'Resource or reference material');

-- Create user_qualifications table
CREATE TABLE public.user_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_type_id UUID REFERENCES public.module_types(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_type_id)
);

-- Create module_instructors junction table (many-to-many)
CREATE TABLE public.module_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, instructor_id)
);

-- Create module_coaches junction table (many-to-many)
CREATE TABLE public.module_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, coach_id)
);

-- Create program_instructors junction table (many-to-many)
CREATE TABLE public.program_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, instructor_id)
);

-- Create program_coaches junction table (many-to-many)
CREATE TABLE public.program_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, coach_id)
);

-- Enable RLS on new tables
ALTER TABLE public.module_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_coaches ENABLE ROW LEVEL SECURITY;

-- RLS policies for module_types (readable by all authenticated users)
CREATE POLICY "Authenticated users can view module types"
  ON public.module_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage module types"
  ON public.module_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_qualifications
CREATE POLICY "Users can view their own qualifications"
  ON public.user_qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all qualifications"
  ON public.user_qualifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all qualifications"
  ON public.user_qualifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for module_instructors
CREATE POLICY "Instructors can view their own assignments"
  ON public.module_instructors FOR SELECT
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage module instructors"
  ON public.module_instructors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for module_coaches
CREATE POLICY "Coaches can view their own assignments"
  ON public.module_coaches FOR SELECT
  USING (auth.uid() = coach_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage module coaches"
  ON public.module_coaches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for program_instructors
CREATE POLICY "Instructors can view their own program assignments"
  ON public.program_instructors FOR SELECT
  USING (auth.uid() = instructor_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage program instructors"
  ON public.program_instructors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for program_coaches
CREATE POLICY "Coaches can view their own program assignments"
  ON public.program_coaches FOR SELECT
  USING (auth.uid() = coach_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage program coaches"
  ON public.program_coaches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for programs to include instructors/coaches
DROP POLICY IF EXISTS "Users can view programs they are enrolled in" ON public.programs;
CREATE POLICY "Users can view programs they have access to"
  ON public.programs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (is_active = true AND EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE client_enrollments.program_id = programs.id
        AND client_enrollments.client_user_id = auth.uid()
    ))
    OR EXISTS (
      SELECT 1 FROM public.program_instructors
      WHERE program_instructors.program_id = programs.id
        AND program_instructors.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.program_coaches
      WHERE program_coaches.program_id = programs.id
        AND program_coaches.coach_id = auth.uid()
    )
  );

-- Update RLS policies for program_modules to include instructors/coaches
DROP POLICY IF EXISTS "Users can view modules of programs they're enrolled in or admin" ON public.program_modules;
CREATE POLICY "Users can view modules they have access to"
  ON public.program_modules FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (is_active = true AND EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE client_enrollments.program_id = program_modules.program_id
        AND client_enrollments.client_user_id = auth.uid()
    ))
    OR EXISTS (
      SELECT 1 FROM public.program_instructors
      WHERE program_instructors.program_id = program_modules.program_id
        AND program_instructors.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.program_coaches
      WHERE program_coaches.program_id = program_modules.program_id
        AND program_coaches.coach_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.module_instructors
      WHERE module_instructors.module_id = program_modules.id
        AND module_instructors.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.module_coaches
      WHERE module_coaches.module_id = program_modules.id
        AND module_coaches.coach_id = auth.uid()
    )
  );

-- Update RLS for client_enrollments to include instructors/coaches
DROP POLICY IF EXISTS "Clients can view their own enrollments" ON public.client_enrollments;
DROP POLICY IF EXISTS "Admins can view all enrollments" ON public.client_enrollments;
CREATE POLICY "Users can view enrollments they have access to"
  ON public.client_enrollments FOR SELECT
  USING (
    auth.uid() = client_user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.program_instructors
      WHERE program_instructors.program_id = client_enrollments.program_id
        AND program_instructors.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.program_coaches
      WHERE program_coaches.program_id = client_enrollments.program_id
        AND program_coaches.coach_id = auth.uid()
    )
  );

-- Update RLS for module_progress to include instructors/coaches
DROP POLICY IF EXISTS "Clients can view their own progress" ON public.module_progress;
DROP POLICY IF EXISTS "Admins can view all progress" ON public.module_progress;
CREATE POLICY "Users can view progress they have access to"
  ON public.module_progress FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE client_enrollments.id = module_progress.enrollment_id
        AND client_enrollments.client_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      JOIN public.program_instructors pi ON pi.program_id = ce.program_id
      WHERE ce.id = module_progress.enrollment_id
        AND pi.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      JOIN public.program_coaches pc ON pc.program_id = ce.program_id
      WHERE ce.id = module_progress.enrollment_id
        AND pc.coach_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.module_instructors mi
      WHERE mi.module_id = module_progress.module_id
        AND mi.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.module_coaches mc
      WHERE mc.module_id = module_progress.module_id
        AND mc.coach_id = auth.uid()
    )
  );

-- Add trigger for updated_at on module_types
CREATE TRIGGER update_module_types_updated_at
  BEFORE UPDATE ON public.module_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();