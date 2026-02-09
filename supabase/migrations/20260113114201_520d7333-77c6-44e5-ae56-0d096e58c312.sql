-- Create table to map program tiers to program plans
CREATE TABLE public.program_tier_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    tier_name TEXT NOT NULL,
    program_plan_id UUID NOT NULL REFERENCES public.program_plans(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(program_id, tier_name)
);

-- Enable RLS
ALTER TABLE public.program_tier_plans ENABLE ROW LEVEL SECURITY;

-- Admin can manage program tier plans
CREATE POLICY "Admins can manage program tier plans"
ON public.program_tier_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read program tier plans (needed for feature access checks)
CREATE POLICY "Authenticated users can read program tier plans"
ON public.program_tier_plans
FOR SELECT
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_program_tier_plans_updated_at
BEFORE UPDATE ON public.program_tier_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.program_tier_plans IS 'Maps program tiers to program plans, allowing different feature access per tier level within a program';