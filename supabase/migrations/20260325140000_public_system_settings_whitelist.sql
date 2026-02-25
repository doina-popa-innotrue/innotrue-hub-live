-- Allow authenticated users to read ONLY specific non-sensitive system settings.
-- The admin-only policy remains for all other keys.
-- This fixes RLS errors from client-side hooks (useCreditRatio, useSupportEmail).

CREATE POLICY "Authenticated users can read public settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (
    key IN (
      'credit_to_eur_ratio',
      'support_email'
    )
  );
