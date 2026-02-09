-- Drop partially created tables from failed migration
DROP TABLE IF EXISTS public.announcements;
DROP TABLE IF EXISTS public.announcement_categories;

-- Create announcement categories table (admin-managed)
CREATE TABLE public.announcement_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'info',
  color TEXT DEFAULT 'blue',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  category_id UUID REFERENCES public.announcement_categories(id) ON DELETE SET NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS for announcement_categories
CREATE POLICY "Authenticated users can view active categories"
  ON public.announcement_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all categories"
  ON public.announcement_categories FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert categories"
  ON public.announcement_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update categories"
  ON public.announcement_categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete categories"
  ON public.announcement_categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS for announcements (authenticated users only, not public)
CREATE POLICY "Authenticated users can view active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default categories
INSERT INTO public.announcement_categories (name, label, icon, color, display_order) VALUES
  ('launched', 'Just Launched', 'Rocket', 'green', 1),
  ('input_requested', 'Calling for Input', 'MessageCircle', 'blue', 2),
  ('coming_soon', 'Coming Soon', 'Clock', 'amber', 3),
  ('maintenance', 'Maintenance Notice', 'Wrench', 'orange', 4),
  ('update', 'Platform Update', 'Sparkles', 'purple', 5);

-- Create function for mass cleanup (delete inactive announcements older than X days)
CREATE OR REPLACE FUNCTION public.cleanup_old_announcements(days_old INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Only allow admins to run this
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can perform mass cleanup';
  END IF;
  
  DELETE FROM public.announcements
  WHERE is_active = false
    AND updated_at < now() - (days_old || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_announcement_categories_updated_at
  BEFORE UPDATE ON public.announcement_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();