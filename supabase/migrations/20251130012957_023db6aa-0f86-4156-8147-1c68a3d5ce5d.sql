-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  billing_interval TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create features table
CREATE TABLE public.features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plan_features join table
CREATE TABLE public.plan_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_id)
);

-- Add plan fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN plan_id UUID REFERENCES public.plans(id),
ADD COLUMN plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plans table
CREATE POLICY "Everyone can view active plans"
ON public.plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all plans"
ON public.plans FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for features table
CREATE POLICY "Everyone can view features"
ON public.features FOR SELECT
USING (true);

CREATE POLICY "Admins can manage all features"
ON public.features FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for plan_features table
CREATE POLICY "Everyone can view plan features"
ON public.plan_features FOR SELECT
USING (true);

CREATE POLICY "Admins can manage plan features"
ON public.plan_features FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger for plans
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for features
CREATE TRIGGER update_features_updated_at
BEFORE UPDATE ON public.features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed data for plans
INSERT INTO public.plans (key, name, description, price_cents, billing_interval, is_active)
VALUES 
  ('free', 'Free', 'Basic features to get started with personal development', 0, null, true),
  ('pro', 'Pro', 'Advanced tools and increased AI coaching capabilities', 2900, 'month', true),
  ('enterprise', 'Enterprise', 'Full platform access with unlimited features and analytics', 9900, 'month', true);

-- Insert seed data for features
INSERT INTO public.features (key, name, description)
VALUES 
  ('decision_toolkit_basic', 'Basic Decision Toolkit', 'Access to basic decision-making frameworks'),
  ('decision_toolkit_advanced', 'Advanced Decision Toolkit', 'Access to all decision frameworks, analytics, and outcome tracking'),
  ('ai_coach', 'AI Coaching', 'AI-powered coaching recommendations and insights'),
  ('coach_dashboard', 'Coach Dashboard', 'Dedicated dashboard for coaches to manage clients'),
  ('org_analytics', 'Organization Analytics', 'Enterprise-level analytics and reporting');

-- Configure plan_features mappings
WITH plan_ids AS (
  SELECT id, key FROM public.plans
),
feature_ids AS (
  SELECT id, key FROM public.features
)
INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
SELECT 
  p.id,
  f.id,
  true,
  CASE
    WHEN p.key = 'free' AND f.key = 'ai_coach' THEN 20
    WHEN p.key = 'pro' AND f.key = 'ai_coach' THEN 200
    WHEN p.key = 'enterprise' AND f.key = 'ai_coach' THEN 1000
    ELSE NULL
  END
FROM plan_ids p
CROSS JOIN feature_ids f
WHERE 
  (p.key = 'free' AND f.key IN ('decision_toolkit_basic', 'ai_coach'))
  OR (p.key = 'pro' AND f.key IN ('decision_toolkit_advanced', 'ai_coach'))
  OR (p.key = 'enterprise' AND f.key IN ('decision_toolkit_advanced', 'ai_coach', 'coach_dashboard', 'org_analytics'));

-- Set all existing users to free plan by default
UPDATE public.profiles
SET plan_id = (SELECT id FROM public.plans WHERE key = 'free')
WHERE plan_id IS NULL;