-- Create scenario categories table for dynamic categorization
CREATE TABLE public.scenario_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'gray',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add category_id to scenario_templates
ALTER TABLE public.scenario_templates
ADD COLUMN category_id UUID REFERENCES public.scenario_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.scenario_categories ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage scenario categories"
  ON public.scenario_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
    )
  );

-- Staff (instructors and coaches) can view active categories
CREATE POLICY "Staff can view scenario categories"
  ON public.scenario_categories FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'instructor'::app_role, 'coach'::app_role])
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_scenario_categories_updated_at
  BEFORE UPDATE ON public.scenario_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_scenario_templates_category ON public.scenario_templates(category_id);