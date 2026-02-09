-- Create platform_terms table for platform-wide T&Cs
CREATE TABLE public.platform_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_blocking_on_update BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_platform_terms_acceptance table
CREATE TABLE public.user_platform_terms_acceptance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform_terms_id UUID NOT NULL REFERENCES public.platform_terms(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  content_hash TEXT NOT NULL,
  UNIQUE(user_id, platform_terms_id)
);

-- Enable RLS
ALTER TABLE public.platform_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_platform_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Platform terms policies - everyone can read current terms
CREATE POLICY "Everyone can view platform terms"
  ON public.platform_terms FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage platform terms"
  ON public.platform_terms FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- User acceptance policies
CREATE POLICY "Users can view their own acceptance"
  ON public.user_platform_terms_acceptance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own acceptance"
  ON public.user_platform_terms_acceptance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acceptances"
  ON public.user_platform_terms_acceptance FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to ensure only one current platform terms at a time
CREATE OR REPLACE FUNCTION public.ensure_single_current_platform_terms()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.platform_terms SET is_current = false WHERE id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_current_platform_terms_trigger
  BEFORE INSERT OR UPDATE ON public.platform_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_current_platform_terms();

-- Add similar trigger for program_terms if not exists
CREATE OR REPLACE FUNCTION public.ensure_single_current_program_terms()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.program_terms SET is_current = false 
    WHERE id != NEW.id AND program_id = NEW.program_id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ensure_single_current_program_terms_trigger ON public.program_terms;
CREATE TRIGGER ensure_single_current_program_terms_trigger
  BEFORE INSERT OR UPDATE ON public.program_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_current_program_terms();