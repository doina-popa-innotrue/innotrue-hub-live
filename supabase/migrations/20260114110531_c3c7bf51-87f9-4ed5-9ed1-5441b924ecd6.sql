-- Create wheel_categories table for dynamic category management
CREATE TABLE public.wheel_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wheel_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories (they're public reference data)
CREATE POLICY "Anyone can view wheel categories"
ON public.wheel_categories
FOR SELECT
USING (true);

-- Only admins can modify categories
CREATE POLICY "Admins can manage wheel categories"
ON public.wheel_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add category column to goal_milestones
ALTER TABLE public.goal_milestones
ADD COLUMN category TEXT;

-- Add category column to tasks
ALTER TABLE public.tasks
ADD COLUMN category TEXT;

-- Create trigger for updated_at on wheel_categories
CREATE TRIGGER update_wheel_categories_updated_at
BEFORE UPDATE ON public.wheel_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();