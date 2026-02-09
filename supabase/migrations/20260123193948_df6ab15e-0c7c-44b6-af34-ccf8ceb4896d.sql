-- Create resource categories table
CREATE TABLE public.resource_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category reference to resource_library
ALTER TABLE public.resource_library 
ADD COLUMN category_id UUID REFERENCES public.resource_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for resource_categories
CREATE POLICY "Admins can manage resource categories"
  ON public.resource_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active categories"
  ON public.resource_categories FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Seed some initial categories
INSERT INTO public.resource_categories (name, description, display_order) VALUES
  ('Salesforce Scenario Short', 'Short scenario-based resources for Salesforce', 1),
  ('InnoTrue Scenario', 'InnoTrue specific scenario resources', 2),
  ('Integration', 'Integration and implementation resources', 3),
  ('Template', 'Reusable templates and frameworks', 4),
  ('Guide', 'How-to guides and documentation', 5);

-- Create index for performance
CREATE INDEX idx_resource_library_category ON public.resource_library(category_id);