-- Create assessment families table for dynamic grouping of related assessment versions
CREATE TABLE public.assessment_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assessment_families ENABLE ROW LEVEL SECURITY;

-- RLS policies - viewable by all authenticated users
CREATE POLICY "Assessment families are viewable by authenticated users"
ON public.assessment_families
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage families
CREATE POLICY "Admins can manage assessment families"
ON public.assessment_families
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add family reference to capability_assessments
ALTER TABLE public.capability_assessments
ADD COLUMN family_id UUID REFERENCES public.assessment_families(id);

-- Link module assignment configs to capability assessments for evaluator grading
-- When instructor reviews a submission, they can complete this assessment as evaluator
ALTER TABLE public.module_assignment_configs
ADD COLUMN linked_capability_assessment_id UUID REFERENCES public.capability_assessments(id);

-- Update timestamp trigger for assessment_families
CREATE TRIGGER update_assessment_families_updated_at
BEFORE UPDATE ON public.assessment_families
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();