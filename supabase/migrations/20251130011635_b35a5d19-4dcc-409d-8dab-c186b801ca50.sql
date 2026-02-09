-- Add certificate storage for external courses
ALTER TABLE public.external_courses
ADD COLUMN certificate_path TEXT,
ADD COLUMN certificate_name TEXT,
ADD COLUMN certificate_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Create skills table
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view skills
CREATE POLICY "Anyone can view skills"
ON public.skills
FOR SELECT
USING (true);

-- Admins can manage skills
CREATE POLICY "Admins can manage skills"
ON public.skills
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create program_skills junction table
CREATE TABLE public.program_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(program_id, skill_id)
);

-- Enable RLS on program_skills
ALTER TABLE public.program_skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view program skills
CREATE POLICY "Anyone can view program skills"
ON public.program_skills
FOR SELECT
USING (true);

-- Admins can manage program skills
CREATE POLICY "Admins can manage program skills"
ON public.program_skills
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create module_skills junction table
CREATE TABLE public.module_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_id, skill_id)
);

-- Enable RLS on module_skills
ALTER TABLE public.module_skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view module skills
CREATE POLICY "Anyone can view module skills"
ON public.module_skills
FOR SELECT
USING (true);

-- Admins can manage module skills
CREATE POLICY "Admins can manage module skills"
ON public.module_skills
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create external_course_skills junction table
CREATE TABLE public.external_course_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_course_id UUID NOT NULL REFERENCES public.external_courses(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_course_id, skill_id)
);

-- Enable RLS on external_course_skills
ALTER TABLE public.external_course_skills ENABLE ROW LEVEL SECURITY;

-- Users can view skills for their external courses
CREATE POLICY "Users can view their external course skills"
ON public.external_course_skills
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.external_courses
  WHERE external_courses.id = external_course_skills.external_course_id
  AND external_courses.user_id = auth.uid()
));

-- Users can manage skills for their external courses
CREATE POLICY "Users can manage their external course skills"
ON public.external_course_skills
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.external_courses
  WHERE external_courses.id = external_course_skills.external_course_id
  AND external_courses.user_id = auth.uid()
));

-- Create user_interests table for AI recommendations
CREATE TABLE public.user_interests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  preferred_categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_interests
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- Users can view their own interests
CREATE POLICY "Users can view their own interests"
ON public.user_interests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own interests
CREATE POLICY "Users can manage their own interests"
ON public.user_interests
FOR ALL
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_interests_updated_at
BEFORE UPDATE ON public.user_interests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX idx_program_skills_program_id ON public.program_skills(program_id);
CREATE INDEX idx_program_skills_skill_id ON public.program_skills(skill_id);
CREATE INDEX idx_module_skills_module_id ON public.module_skills(module_id);
CREATE INDEX idx_module_skills_skill_id ON public.module_skills(skill_id);
CREATE INDEX idx_external_course_skills_course_id ON public.external_course_skills(external_course_id);
CREATE INDEX idx_external_course_skills_skill_id ON public.external_course_skills(skill_id);
CREATE INDEX idx_user_interests_user_id ON public.user_interests(user_id);