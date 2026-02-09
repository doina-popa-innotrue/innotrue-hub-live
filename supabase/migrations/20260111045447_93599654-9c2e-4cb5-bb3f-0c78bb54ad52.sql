-- Create partner_programs table for external partner offerings
CREATE TABLE public.partner_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'partner',
  provider_logo_url TEXT,
  program_url TEXT NOT NULL,
  referral_code TEXT,
  category_id UUID REFERENCES public.program_categories(id),
  price_info TEXT,
  duration_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_programs ENABLE ROW LEVEL SECURITY;

-- Admin can manage partner programs
CREATE POLICY "Admins can manage partner programs"
ON public.partner_programs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- All authenticated users can view active partner programs
CREATE POLICY "Users can view active partner programs"
ON public.partner_programs
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_partner_programs_updated_at
BEFORE UPDATE ON public.partner_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create partner_program_clicks table to track referral clicks
CREATE TABLE public.partner_program_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_program_id UUID NOT NULL REFERENCES public.partner_programs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_program_clicks ENABLE ROW LEVEL SECURITY;

-- Users can insert their own clicks
CREATE POLICY "Users can track their clicks"
ON public.partner_program_clicks
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all clicks
CREATE POLICY "Admins can view all clicks"
ON public.partner_program_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);