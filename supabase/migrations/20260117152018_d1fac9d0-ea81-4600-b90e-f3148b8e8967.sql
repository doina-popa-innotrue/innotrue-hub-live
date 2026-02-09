-- Drop the function first to recreate with correct tables
DROP FUNCTION IF EXISTS public.user_has_feature(_user_id uuid, _feature_key text);

-- Create a security definer function to check if user has a specific feature
-- Checks: subscription, program plan enrollments, add-ons, and tracks
CREATE OR REPLACE FUNCTION public.user_has_feature(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check subscription features
    SELECT 1 FROM profiles p
    JOIN plans pl ON pl.id = p.plan_id
    JOIN plan_features pf ON pf.plan_id = pl.id
    JOIN features f ON f.id = pf.feature_id
    WHERE p.id = _user_id AND f.key = _feature_key
    
    UNION ALL
    
    -- Check program plan features (via active enrollments)
    SELECT 1 FROM client_enrollments ce
    JOIN program_plans pp ON pp.id = ce.program_plan_id
    JOIN program_plan_features ppf ON ppf.program_plan_id = pp.id
    JOIN features f ON f.id = ppf.feature_id
    WHERE ce.client_user_id = _user_id 
      AND ce.status IN ('active', 'completed')
      AND f.key = _feature_key
    
    UNION ALL
    
    -- Check add-on features (active if not expired)
    SELECT 1 FROM user_add_ons uao
    JOIN add_on_features aof ON aof.add_on_id = uao.add_on_id
    JOIN features f ON f.id = aof.feature_id
    WHERE uao.user_id = _user_id 
      AND (uao.expires_at IS NULL OR uao.expires_at > now())
      AND f.key = _feature_key
    
    UNION ALL
    
    -- Check track features
    SELECT 1 FROM user_tracks ut
    JOIN track_features tf ON tf.track_id = ut.track_id
    JOIN features f ON f.id = tf.feature_id
    WHERE ut.user_id = _user_id 
      AND ut.is_active = true
      AND f.key = _feature_key
  )
$$;