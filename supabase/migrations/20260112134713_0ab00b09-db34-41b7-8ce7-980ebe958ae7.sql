-- Create junction table for resource library skills
CREATE TABLE public.resource_library_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resource_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.resource_library_skills ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can manage
CREATE POLICY "Admins can manage resource skills"
  ON public.resource_library_skills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Anyone can read resource skills for published resources
CREATE POLICY "Anyone can read published resource skills"
  ON public.resource_library_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.resource_library rl
      WHERE rl.id = resource_id AND rl.is_published = true
    )
  );

-- Add index for efficient lookups
CREATE INDEX idx_resource_library_skills_resource_id ON public.resource_library_skills(resource_id);
CREATE INDEX idx_resource_library_skills_skill_id ON public.resource_library_skills(skill_id);