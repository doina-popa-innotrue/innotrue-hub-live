-- Table for admin-managed status markers
CREATE TABLE public.status_markers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default status markers
INSERT INTO public.status_markers (name, display_order) VALUES
  ('CTA Candidate', 1),
  ('Architect', 2),
  ('Alumni', 3),
  ('Elite', 4);

-- Enable RLS
ALTER TABLE public.status_markers ENABLE ROW LEVEL SECURITY;

-- Policies for status_markers
CREATE POLICY "Admins can manage status markers"
ON public.status_markers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view active status markers"
ON public.status_markers FOR SELECT
USING (is_active = true);

-- Table for tracking user acquired skills
CREATE TABLE public.user_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source_type TEXT NOT NULL DEFAULT 'module_completion', -- 'module_completion', 'manual', 'external_course'
  source_id UUID, -- references module_progress.id or external_courses.id
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Policies for user_skills
CREATE POLICY "Users can view their own skills"
ON public.user_skills FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own skills visibility"
ON public.user_skills FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert user skills on completion"
ON public.user_skills FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user skills"
ON public.user_skills FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view public skills by user_id"
ON public.user_skills FOR SELECT
USING (is_public = true);

-- Add trigger to update timestamps
CREATE TRIGGER update_status_markers_updated_at
BEFORE UPDATE ON public.status_markers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();