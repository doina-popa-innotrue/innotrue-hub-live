-- Add category reference to features table
ALTER TABLE public.features 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.feature_categories(id) ON DELETE SET NULL;