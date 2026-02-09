-- Create feature categories table (if not exists)
CREATE TABLE IF NOT EXISTS public.feature_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_categories ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage categories using has_role function
CREATE POLICY "Admins can manage feature categories"
ON public.feature_categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to view categories (for UI display)
CREATE POLICY "Authenticated users can view feature categories"
ON public.feature_categories
FOR SELECT
TO authenticated
USING (true);

-- Create trigger for updated_at (if not exists)
DROP TRIGGER IF EXISTS update_feature_categories_updated_at ON public.feature_categories;
CREATE TRIGGER update_feature_categories_updated_at
BEFORE UPDATE ON public.feature_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();