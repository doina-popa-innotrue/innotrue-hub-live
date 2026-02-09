-- Create skill_categories table for managing skill category clusters
CREATE TABLE public.skill_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read categories
CREATE POLICY "Anyone can view skill categories"
  ON public.skill_categories
  FOR SELECT
  USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage skill categories"
  ON public.skill_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add category_id foreign key to skills table
ALTER TABLE public.skills 
  ADD COLUMN category_id UUID REFERENCES public.skill_categories(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_skills_category_id ON public.skills(category_id);
CREATE INDEX idx_skill_categories_order ON public.skill_categories(order_index);

-- Add updated_at trigger
CREATE TRIGGER update_skill_categories_updated_at
  BEFORE UPDATE ON public.skill_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial categories from existing skill category values
INSERT INTO public.skill_categories (name, key, order_index)
SELECT DISTINCT 
  category as name,
  lower(regexp_replace(category, '[^a-zA-Z0-9]+', '_', 'g')) as key,
  ROW_NUMBER() OVER (ORDER BY category) as order_index
FROM public.skills
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (key) DO NOTHING;

-- Update skills to reference the new category_id based on existing category text
UPDATE public.skills s
SET category_id = sc.id
FROM public.skill_categories sc
WHERE s.category = sc.name;