-- Insert retention period settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('program_terms_retention_years', '7', 'Number of years to retain program terms acceptances after acceptance date'),
  ('org_terms_retention_years', '7', 'Number of years to retain organization terms acceptances after acceptance date')
ON CONFLICT (key) DO NOTHING;

-- Update the purge function to use configurable retention periods
CREATE OR REPLACE FUNCTION public.purge_expired_terms_acceptances()
RETURNS INTEGER AS $$
DECLARE
  total_deleted INTEGER := 0;
  deleted_count INTEGER;
  program_retention_years INTEGER;
  org_retention_years INTEGER;
BEGIN
  -- Get configurable retention periods from system settings
  SELECT COALESCE(value::INTEGER, 7) INTO program_retention_years
  FROM public.system_settings WHERE key = 'program_terms_retention_years';
  
  SELECT COALESCE(value::INTEGER, 7) INTO org_retention_years
  FROM public.system_settings WHERE key = 'org_terms_retention_years';

  -- Default to 7 if settings not found
  program_retention_years := COALESCE(program_retention_years, 7);
  org_retention_years := COALESCE(org_retention_years, 7);

  -- Purge expired program terms acceptances
  DELETE FROM public.user_program_terms_acceptance
  WHERE accepted_at < (now() - (program_retention_years || ' years')::INTERVAL);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;

  -- Purge expired organization terms acceptances
  DELETE FROM public.user_organization_terms_acceptance
  WHERE accepted_at < (now() - (org_retention_years || ' years')::INTERVAL);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;

  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.purge_expired_terms_acceptances() TO service_role;