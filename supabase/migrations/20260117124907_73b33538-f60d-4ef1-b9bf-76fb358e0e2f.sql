-- Add retention tracking to all terms acceptance tables
-- Standard retention period: 7 years (2555 days) for legal compliance

-- Platform terms acceptance - add retention
ALTER TABLE public.user_platform_terms_acceptance 
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

-- Set default retention (7 years from acceptance)
UPDATE public.user_platform_terms_acceptance 
SET retention_expires_at = accepted_at + INTERVAL '7 years'
WHERE retention_expires_at IS NULL;

-- Program terms acceptance - add retention  
ALTER TABLE public.user_program_terms_acceptance
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

UPDATE public.user_program_terms_acceptance
SET retention_expires_at = accepted_at + INTERVAL '7 years'
WHERE retention_expires_at IS NULL;

-- Org terms acceptance - add retention
ALTER TABLE public.user_organization_terms_acceptance
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

UPDATE public.user_organization_terms_acceptance
SET retention_expires_at = accepted_at + INTERVAL '7 years'
WHERE retention_expires_at IS NULL;

-- Create a function to purge expired terms acceptance records
CREATE OR REPLACE FUNCTION public.purge_expired_terms_acceptances()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_deleted INTEGER := 0;
  deleted_count INTEGER;
BEGIN
  -- Purge expired platform terms acceptances
  DELETE FROM public.user_platform_terms_acceptance
  WHERE retention_expires_at IS NOT NULL 
    AND retention_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Purge expired program terms acceptances
  DELETE FROM public.user_program_terms_acceptance
  WHERE retention_expires_at IS NOT NULL 
    AND retention_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  -- Purge expired organization terms acceptances
  DELETE FROM public.user_organization_terms_acceptance
  WHERE retention_expires_at IS NOT NULL 
    AND retention_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  
  RETURN total_deleted;
END;
$$;

-- Grant execute to service role for scheduled jobs
GRANT EXECUTE ON FUNCTION public.purge_expired_terms_acceptances() TO service_role;