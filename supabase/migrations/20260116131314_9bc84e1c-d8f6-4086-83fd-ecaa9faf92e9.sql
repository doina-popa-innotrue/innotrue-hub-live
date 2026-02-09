-- =============================================
-- Add privacy controls columns to tables
-- =============================================

-- 1. Add is_private column to goals
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 2. Add is_private column to goal_milestones
ALTER TABLE public.goal_milestones ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 3. Add is_private column to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 4. Add is_private column to development_items
ALTER TABLE public.development_items ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 5. Add is_private column to goal_reflections
ALTER TABLE public.goal_reflections ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 6. Add is_private column to goal_comments
ALTER TABLE public.goal_comments ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 7. Add is_private column to capability_snapshots
ALTER TABLE public.capability_snapshots ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 8. Add is_private column to user_interests
ALTER TABLE public.user_interests ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 9. Add privacy fields to profiles for personal vision data
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS future_vision_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS constraints_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS desired_target_role_private boolean NOT NULL DEFAULT false;

-- =============================================
-- Update RLS policies for goals
-- =============================================

-- Drop ALL existing goal SELECT policies first
DROP POLICY IF EXISTS "Public goals viewable by authenticated users" ON public.goals;
DROP POLICY IF EXISTS "Coaches can view their clients goals" ON public.goals;
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
DROP POLICY IF EXISTS "Admins can view all goals" ON public.goals;
DROP POLICY IF EXISTS "Assigned coaches can view client non-private goals" ON public.goals;
DROP POLICY IF EXISTS "Assigned instructors can view client non-private goals" ON public.goals;
DROP POLICY IF EXISTS "Public goals are viewable by anyone" ON public.goals;

-- Owner can view all their goals
CREATE POLICY "Users can view their own goals"
ON public.goals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Assigned coaches can view non-private goals of their clients
CREATE POLICY "Assigned coaches can view client non-private goals"
ON public.goals FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = goals.user_id
  )
);

-- Assigned instructors can view non-private goals of their clients
CREATE POLICY "Assigned instructors can view client non-private goals"
ON public.goals FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.instructor_id = auth.uid() 
    AND ci.client_id = goals.user_id
  )
);

-- Admins can view all goals (for technical support)
CREATE POLICY "Admins can view all goals"
ON public.goals FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for goal_milestones
-- =============================================

DROP POLICY IF EXISTS "Users can view milestones for their goals" ON public.goal_milestones;
DROP POLICY IF EXISTS "Coaches can view milestones" ON public.goal_milestones;
DROP POLICY IF EXISTS "Admins can view all milestones" ON public.goal_milestones;
DROP POLICY IF EXISTS "Assigned coaches can view client non-private milestones" ON public.goal_milestones;
DROP POLICY IF EXISTS "Assigned instructors can view client non-private milestones" ON public.goal_milestones;

CREATE POLICY "Users can view milestones for their goals"
ON public.goal_milestones FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goals g 
    WHERE g.id = goal_milestones.goal_id 
    AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Assigned coaches can view client non-private milestones"
ON public.goal_milestones FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_coaches cc ON cc.client_id = g.user_id
    WHERE g.id = goal_milestones.goal_id
    AND g.is_private = false
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Assigned instructors can view client non-private milestones"
ON public.goal_milestones FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_instructors ci ON ci.client_id = g.user_id
    WHERE g.id = goal_milestones.goal_id
    AND g.is_private = false
    AND ci.instructor_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all milestones"
ON public.goal_milestones FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for tasks
-- =============================================

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Coaches can view shared tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned coaches can view shared non-private tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned instructors can view shared non-private tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view shared non-private tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  is_private = false
  AND shared_with_coach = true
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = tasks.user_id
  )
);

CREATE POLICY "Assigned instructors can view shared non-private tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  is_private = false
  AND shared_with_coach = true
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.instructor_id = auth.uid() 
    AND ci.client_id = tasks.user_id
  )
);

CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for development_items
-- =============================================

DROP POLICY IF EXISTS "Users can view their own development items" ON public.development_items;
DROP POLICY IF EXISTS "Coaches can view client development items" ON public.development_items;
DROP POLICY IF EXISTS "Admins can view all development items" ON public.development_items;
DROP POLICY IF EXISTS "Assigned coaches can view non-private development items" ON public.development_items;
DROP POLICY IF EXISTS "Assigned instructors can view non-private development items" ON public.development_items;

CREATE POLICY "Users can view their own development items"
ON public.development_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view non-private development items"
ON public.development_items FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = development_items.user_id
  )
);

CREATE POLICY "Assigned instructors can view non-private development items"
ON public.development_items FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.instructor_id = auth.uid() 
    AND ci.client_id = development_items.user_id
  )
);

CREATE POLICY "Admins can view all development items"
ON public.development_items FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for goal_reflections
-- =============================================

DROP POLICY IF EXISTS "Users can view own reflections" ON public.goal_reflections;
DROP POLICY IF EXISTS "Coaches can view reflections" ON public.goal_reflections;
DROP POLICY IF EXISTS "Users can view own goal reflections" ON public.goal_reflections;
DROP POLICY IF EXISTS "Admins can view all goal reflections" ON public.goal_reflections;
DROP POLICY IF EXISTS "Assigned coaches can view non-private goal reflections" ON public.goal_reflections;
DROP POLICY IF EXISTS "Assigned instructors can view non-private goal reflections" ON public.goal_reflections;

CREATE POLICY "Users can view own goal reflections"
ON public.goal_reflections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view non-private goal reflections"
ON public.goal_reflections FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_coaches cc ON cc.client_id = g.user_id
    WHERE g.id = goal_reflections.goal_id
    AND g.is_private = false
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Assigned instructors can view non-private goal reflections"
ON public.goal_reflections FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_instructors ci ON ci.client_id = g.user_id
    WHERE g.id = goal_reflections.goal_id
    AND g.is_private = false
    AND ci.instructor_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all goal reflections"
ON public.goal_reflections FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for goal_comments
-- =============================================

DROP POLICY IF EXISTS "Users can view comments on their goals" ON public.goal_comments;
DROP POLICY IF EXISTS "Users can view comments on shared goals" ON public.goal_comments;
DROP POLICY IF EXISTS "Users can view their own comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Admins can view all goal comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Assigned coaches can view non-private goal comments" ON public.goal_comments;
DROP POLICY IF EXISTS "Assigned instructors can view non-private goal comments" ON public.goal_comments;

CREATE POLICY "Users can view comments on their goals"
ON public.goal_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.goals g 
    WHERE g.id = goal_comments.goal_id 
    AND g.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own comments"
ON public.goal_comments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view non-private goal comments"
ON public.goal_comments FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_coaches cc ON cc.client_id = g.user_id
    WHERE g.id = goal_comments.goal_id
    AND g.is_private = false
    AND cc.coach_id = auth.uid()
  )
);

CREATE POLICY "Assigned instructors can view non-private goal comments"
ON public.goal_comments FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.goals g
    JOIN public.client_instructors ci ON ci.client_id = g.user_id
    WHERE g.id = goal_comments.goal_id
    AND g.is_private = false
    AND ci.instructor_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all goal comments"
ON public.goal_comments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for capability_snapshots
-- =============================================

DROP POLICY IF EXISTS "Users can view own assessments" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Coaches can view shared assessments" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Users can view their own capability snapshots" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Coaches can view shared capability snapshots" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Users can view own capability snapshots" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Admins can view all capability snapshots" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Assigned coaches can view shared non-private assessments" ON public.capability_snapshots;
DROP POLICY IF EXISTS "Assigned instructors can view shared non-private assessments" ON public.capability_snapshots;

CREATE POLICY "Users can view own capability snapshots"
ON public.capability_snapshots FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view shared non-private assessments"
ON public.capability_snapshots FOR SELECT
TO authenticated
USING (
  is_private = false
  AND shared_with_coach = true
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = capability_snapshots.user_id
  )
);

CREATE POLICY "Assigned instructors can view shared non-private assessments"
ON public.capability_snapshots FOR SELECT
TO authenticated
USING (
  is_private = false
  AND shared_with_coach = true
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.instructor_id = auth.uid() 
    AND ci.client_id = capability_snapshots.user_id
  )
);

CREATE POLICY "Admins can view all capability snapshots"
ON public.capability_snapshots FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Update RLS policies for user_interests
-- =============================================

DROP POLICY IF EXISTS "Users can view their own interests" ON public.user_interests;
DROP POLICY IF EXISTS "Coaches can view client interests" ON public.user_interests;
DROP POLICY IF EXISTS "Admins can view all user interests" ON public.user_interests;
DROP POLICY IF EXISTS "Assigned coaches can view non-private interests" ON public.user_interests;
DROP POLICY IF EXISTS "Assigned instructors can view non-private interests" ON public.user_interests;

CREATE POLICY "Users can view their own interests"
ON public.user_interests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Assigned coaches can view non-private interests"
ON public.user_interests FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.coach_id = auth.uid() 
    AND cc.client_id = user_interests.user_id
  )
);

CREATE POLICY "Assigned instructors can view non-private interests"
ON public.user_interests FOR SELECT
TO authenticated
USING (
  is_private = false
  AND EXISTS (
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.instructor_id = auth.uid() 
    AND ci.client_id = user_interests.user_id
  )
);

CREATE POLICY "Admins can view all user interests"
ON public.user_interests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Create helper function for profile field privacy check
-- =============================================

CREATE OR REPLACE FUNCTION public.can_view_profile_field(
  _profile_user_id uuid,
  _field_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_private boolean;
BEGIN
  -- Owner can always view
  IF auth.uid() = _profile_user_id THEN
    RETURN true;
  END IF;

  -- Admins can always view
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN true;
  END IF;

  -- Check if assigned coach or instructor
  IF NOT EXISTS (
    SELECT 1 FROM public.client_coaches cc 
    WHERE cc.client_id = _profile_user_id AND cc.coach_id = auth.uid()
    UNION
    SELECT 1 FROM public.client_instructors ci 
    WHERE ci.client_id = _profile_user_id AND ci.instructor_id = auth.uid()
  ) THEN
    RETURN false;
  END IF;

  -- Check privacy setting for the specific field
  CASE _field_name
    WHEN 'future_vision' THEN
      SELECT future_vision_private INTO _is_private FROM public.profiles WHERE id = _profile_user_id;
    WHEN 'constraints' THEN
      SELECT constraints_private INTO _is_private FROM public.profiles WHERE id = _profile_user_id;
    WHEN 'desired_target_role' THEN
      SELECT desired_target_role_private INTO _is_private FROM public.profiles WHERE id = _profile_user_id;
    ELSE
      RETURN true;
  END CASE;

  RETURN NOT COALESCE(_is_private, false);
END;
$$;