-- Drop the partially created tables if they exist
DROP TABLE IF EXISTS public.program_plan_features;
DROP TABLE IF EXISTS public.program_plans;

-- Remove columns if they were added
ALTER TABLE public.client_enrollments DROP COLUMN IF EXISTS program_plan_id;
ALTER TABLE public.programs DROP COLUMN IF EXISTS default_program_plan_id;

-- Create program_plans table for program-specific feature access
CREATE TABLE public.program_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tier_level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create program_plan_features to link program plans to features
CREATE TABLE public.program_plan_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_plan_id UUID NOT NULL REFERENCES public.program_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(program_plan_id, feature_id)
);

-- Add program_plan_id to client_enrollments to track which program plan applies to an enrollment
ALTER TABLE public.client_enrollments 
ADD COLUMN program_plan_id UUID REFERENCES public.program_plans(id);

-- Add default_program_plan_id to programs so new enrollments auto-assign a program plan
ALTER TABLE public.programs 
ADD COLUMN default_program_plan_id UUID REFERENCES public.program_plans(id);

-- Enable RLS
ALTER TABLE public.program_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_plan_features ENABLE ROW LEVEL SECURITY;

-- RLS policies for program_plans (admins can manage, all authenticated can view)
CREATE POLICY "Admins can manage program plans" 
ON public.program_plans 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Authenticated users can view active program plans" 
ON public.program_plans 
FOR SELECT 
USING (is_active = true);

-- RLS policies for program_plan_features
CREATE POLICY "Admins can manage program plan features" 
ON public.program_plan_features 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Authenticated users can view program plan features" 
ON public.program_plan_features 
FOR SELECT 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_program_plans_updated_at
BEFORE UPDATE ON public.program_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_program_plan_features_plan_id ON public.program_plan_features(program_plan_id);
CREATE INDEX idx_program_plan_features_feature_id ON public.program_plan_features(feature_id);
CREATE INDEX idx_client_enrollments_program_plan ON public.client_enrollments(program_plan_id);
CREATE INDEX idx_programs_default_program_plan ON public.programs(default_program_plan_id);