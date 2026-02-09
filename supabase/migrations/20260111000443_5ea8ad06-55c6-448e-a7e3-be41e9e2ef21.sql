-- Fix system_settings: require authentication for reading
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated
USING (true);

-- Fix goals: update policy to properly check public profile settings
DROP POLICY IF EXISTS "Anyone can view public goals for public profiles" ON public.goals;

-- Allow anyone (including unauthenticated) to view public goals from users with public profiles
CREATE POLICY "Anyone can view public goals for public profiles" 
ON public.goals 
FOR SELECT 
TO anon, authenticated
USING (
  is_public = true 
  AND EXISTS (
    SELECT 1 FROM public.public_profile_settings pps 
    WHERE pps.user_id = goals.user_id 
    AND pps.is_public = true
  )
);

-- Allow coaches to view their clients' goals
CREATE POLICY "Coaches can view their clients goals" 
ON public.goals 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = goals.user_id
  )
);