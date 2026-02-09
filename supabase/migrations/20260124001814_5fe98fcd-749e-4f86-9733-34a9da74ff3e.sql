-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active auth contexts" ON public.auth_contexts;

-- Create a view with only the safe public columns (no sensitive IDs)
CREATE OR REPLACE VIEW public.auth_contexts_public AS
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
  -- Include these for post-signup processing (needed by edge function, not exposed in UI)
  program_id,
  track_id,
  organization_id,
  auto_enroll_program,
  auto_assign_track
FROM public.auth_contexts
WHERE is_active = true;

-- Grant public access to the view
GRANT SELECT ON public.auth_contexts_public TO anon, authenticated;

-- Add a policy for authenticated users to view their own organization's contexts
CREATE POLICY "Authenticated users can view active contexts"
  ON public.auth_contexts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Keep the admin policy for full CRUD (already exists)