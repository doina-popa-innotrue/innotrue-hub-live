-- Create program_categories table
CREATE TABLE public.program_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.program_categories ENABLE ROW LEVEL SECURITY;

-- Admins can manage categories
CREATE POLICY "Admins can manage program categories"
ON public.program_categories
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can view active categories
CREATE POLICY "Authenticated users can view active program categories"
ON public.program_categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Update trigger
CREATE TRIGGER update_program_categories_updated_at
BEFORE UPDATE ON public.program_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories based on existing program categories
INSERT INTO public.program_categories (key, name, display_order) VALUES
('cta', 'CTA', 1),
('leadership', 'Leadership', 2),
('executive', 'Executive', 3),
('ai', 'AI', 4),
('deep-dive', 'Deep Dive', 5);