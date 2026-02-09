-- Recreate view with SECURITY INVOKER (safer - uses caller's permissions)
DROP VIEW IF EXISTS public.auth_contexts_public;

CREATE VIEW public.auth_contexts_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  slug,
  public_code,
  context_type,
  headline,
  subheadline,
  description,
  features,
  logo_url,
  primary_color,
  default_to_signup,
  is_active,
  allow_slug_access,
  program_id,
  track_id,
  organization_id,
  auto_enroll_program,
  auto_assign_track
FROM public.auth_contexts
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.auth_contexts_public TO anon, authenticated;

-- Add policy for anonymous users to read via the base table (needed for view access)
CREATE POLICY "Anonymous can view active auth contexts"
  ON public.auth_contexts
  FOR SELECT
  TO anon
  USING (is_active = true);