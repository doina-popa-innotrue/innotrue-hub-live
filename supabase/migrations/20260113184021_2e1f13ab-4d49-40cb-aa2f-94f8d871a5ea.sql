-- Add category_id to psychometric_assessments (replacing the text category field)
ALTER TABLE public.psychometric_assessments 
ADD COLUMN category_id uuid REFERENCES public.assessment_categories(id);

-- Migrate existing text categories to the new category_id where possible
-- First, add common categories if they don't exist
INSERT INTO public.assessment_categories (name, description, order_index, is_active)
VALUES 
  ('personality', 'Personality type and trait assessments', 4, true),
  ('aptitude', 'Aptitude and skill assessments', 5, true),
  ('career', 'Career interest and development assessments', 6, true),
  ('emotional-intelligence', 'Emotional intelligence assessments', 7, true),
  ('team', 'Team dynamics and collaboration assessments', 8, true),
  ('architecture', 'Technical architecture assessments', 9, true),
  ('psychometric', 'Psychometric and psychological assessments', 10, true),
  ('other', 'Other assessment types', 99, true)
ON CONFLICT DO NOTHING;

-- Add category_id and feature_key to assessment_definitions
ALTER TABLE public.assessment_definitions 
ADD COLUMN category_id uuid REFERENCES public.assessment_categories(id),
ADD COLUMN feature_key text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_psychometric_assessments_category_id ON public.psychometric_assessments(category_id);
CREATE INDEX IF NOT EXISTS idx_assessment_definitions_category_id ON public.assessment_definitions(category_id);