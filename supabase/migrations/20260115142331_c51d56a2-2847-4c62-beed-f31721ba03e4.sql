
-- Create view for public external courses with correct columns
CREATE VIEW public.public_external_courses_view
WITH (security_invoker = false)
AS
SELECT 
  ec.id,
  ec.user_id,
  ec.title,
  ec.provider,
  ec.status,
  ec.certificate_path,
  ec.certificate_name
FROM public.external_courses ec
INNER JOIN public.public_profile_settings pps ON ec.user_id = pps.user_id
WHERE ec.is_public = true AND pps.is_public = true;

GRANT SELECT ON public.public_external_courses_view TO anon;
GRANT SELECT ON public.public_external_courses_view TO authenticated;

-- Now secure remaining base tables that weren't handled in previous partial run

-- Secure the base tables - require authentication for direct access
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coach') OR
  public.has_role(auth.uid(), 'instructor')
);

-- Goals: secure base table
DROP POLICY IF EXISTS "Anyone can view public goals" ON public.goals;
DROP POLICY IF EXISTS "Authenticated users can view public goals" ON public.goals;
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Staff can view all goals" ON public.goals;

CREATE POLICY "Users can view own goals"
ON public.goals FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view all goals"
ON public.goals FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coach') OR
  public.has_role(auth.uid(), 'instructor')
);

-- Client enrollments: secure base table
DROP POLICY IF EXISTS "Anyone can view public enrollments" ON public.client_enrollments;
DROP POLICY IF EXISTS "Authenticated users can view public enrollments" ON public.client_enrollments;
DROP POLICY IF EXISTS "Users can view own enrollments" ON public.client_enrollments;

CREATE POLICY "Users can view own enrollments"
ON public.client_enrollments FOR SELECT
TO authenticated
USING (client_user_id = auth.uid());

-- External courses: secure base table
DROP POLICY IF EXISTS "Anyone can view public external courses" ON public.external_courses;
DROP POLICY IF EXISTS "Authenticated users can view public courses" ON public.external_courses;
DROP POLICY IF EXISTS "Users can view own external courses" ON public.external_courses;
DROP POLICY IF EXISTS "Staff can view all external courses" ON public.external_courses;

CREATE POLICY "Users can view own external courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Staff can view all external courses"
ON public.external_courses FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'coach') OR
  public.has_role(auth.uid(), 'instructor')
);

-- Public profile settings: owner only for direct access
DROP POLICY IF EXISTS "Anyone can view enabled public profile settings" ON public.public_profile_settings;
DROP POLICY IF EXISTS "Authenticated users can view public settings" ON public.public_profile_settings;
DROP POLICY IF EXISTS "Users can view own public profile settings" ON public.public_profile_settings;

CREATE POLICY "Users can view own public profile settings"
ON public.public_profile_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Public profile interests: owner only for direct access
DROP POLICY IF EXISTS "Anyone can view interests for public profiles" ON public.public_profile_interests;
DROP POLICY IF EXISTS "Authenticated users can view public interests" ON public.public_profile_interests;
DROP POLICY IF EXISTS "Users can view own public profile interests" ON public.public_profile_interests;

CREATE POLICY "Users can view own public profile interests"
ON public.public_profile_interests FOR SELECT
TO authenticated
USING (user_id = auth.uid());
