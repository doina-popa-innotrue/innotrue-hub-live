-- Remove retention_expires_at from platform terms (will purge with account deletion only)
ALTER TABLE public.user_platform_terms_acceptance DROP COLUMN IF EXISTS retention_expires_at;

-- Program terms: keep 7 years from acceptance (no direct enrollment link)
-- Org terms: keep 7 years from acceptance (already set)

-- Update the purge function to only handle program and org terms (not platform)
CREATE OR REPLACE FUNCTION public.purge_expired_terms_acceptances()
RETURNS INTEGER AS $$
DECLARE
  total_deleted INTEGER := 0;
  deleted_count INTEGER;
BEGIN
  -- Purge expired program terms acceptances (7 years from acceptance)
  DELETE FROM public.user_program_terms_acceptance
  WHERE retention_expires_at IS NOT NULL AND retention_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;

  -- Purge expired organization terms acceptances (7 years from acceptance)
  DELETE FROM public.user_organization_terms_acceptance
  WHERE retention_expires_at IS NOT NULL AND retention_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;

  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.purge_expired_terms_acceptances() TO service_role;