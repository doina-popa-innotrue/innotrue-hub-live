-- Update goals to require authentication for public viewing
DROP POLICY IF EXISTS "Public goals are viewable by anyone" ON public.goals;
DROP POLICY IF EXISTS "Public goals viewable by authenticated users" ON public.goals;
CREATE POLICY "Public goals viewable by authenticated users"
ON public.goals FOR SELECT
USING (
  is_public = true 
  OR auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.client_coaches cc WHERE cc.client_id = user_id AND cc.coach_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update user_skills to require authentication
DROP POLICY IF EXISTS "Public skills viewable by anyone" ON public.user_skills;
DROP POLICY IF EXISTS "Public skills viewable by authenticated users" ON public.user_skills;
CREATE POLICY "Public skills viewable by authenticated users"
ON public.user_skills FOR SELECT
USING (
  is_public = true
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update external_courses to require authentication for public
DROP POLICY IF EXISTS "Public courses viewable by anyone" ON public.external_courses;
DROP POLICY IF EXISTS "Public courses viewable by authenticated users" ON public.external_courses;
CREATE POLICY "Public courses viewable by authenticated users"
ON public.external_courses FOR SELECT
USING (
  is_public = true
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update public_profile_settings - only owner and admin can read settings
DROP POLICY IF EXISTS "Public profile settings readable by anyone" ON public.public_profile_settings;
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.public_profile_settings;
DROP POLICY IF EXISTS "Profile settings readable by owner and admin" ON public.public_profile_settings;
CREATE POLICY "Profile settings readable by owner and admin"
ON public.public_profile_settings FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update public_profile_interests - only owner and admin can read
DROP POLICY IF EXISTS "Public interests viewable by anyone" ON public.public_profile_interests;
DROP POLICY IF EXISTS "Profile interests readable by owner and admin" ON public.public_profile_interests;
CREATE POLICY "Profile interests readable by owner and admin"
ON public.public_profile_interests FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);