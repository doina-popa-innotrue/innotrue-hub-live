
-- Create program_terms table for storing T&C versions
CREATE TABLE public.program_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_blocking_on_first_access BOOLEAN NOT NULL DEFAULT true,
  is_blocking_on_update BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(program_id, version)
);

-- Create user_program_terms_acceptance table for tracking acceptances
CREATE TABLE public.user_program_terms_acceptance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_terms_id UUID NOT NULL REFERENCES public.program_terms(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  content_hash TEXT NOT NULL,
  UNIQUE(user_id, program_terms_id)
);

-- Enable RLS
ALTER TABLE public.program_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- RLS policies for program_terms
CREATE POLICY "Admins can manage all program terms"
ON public.program_terms
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view current terms for enrolled programs"
ON public.program_terms
FOR SELECT
USING (
  is_current = true AND (
    EXISTS (
      SELECT 1 FROM public.client_enrollments
      WHERE client_enrollments.program_id = program_terms.program_id
      AND client_enrollments.client_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- RLS policies for user_program_terms_acceptance
CREATE POLICY "Users can view their own acceptances"
ON public.user_program_terms_acceptance
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own acceptances"
ON public.user_program_terms_acceptance
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all acceptances"
ON public.user_program_terms_acceptance
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to ensure only one current version per program
CREATE OR REPLACE FUNCTION public.ensure_single_current_terms()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.program_terms
    SET is_current = false, updated_at = now()
    WHERE program_id = NEW.program_id
    AND id != NEW.id
    AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_current_terms_trigger
BEFORE INSERT OR UPDATE ON public.program_terms
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_current_terms();

-- Update trigger for updated_at
CREATE TRIGGER update_program_terms_updated_at
BEFORE UPDATE ON public.program_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_program_terms_program_current ON public.program_terms(program_id, is_current) WHERE is_current = true;
CREATE INDEX idx_user_terms_acceptance_user ON public.user_program_terms_acceptance(user_id);
