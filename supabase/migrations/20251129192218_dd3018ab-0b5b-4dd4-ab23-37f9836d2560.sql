-- Create goal_shares table to track sharing permissions
CREATE TABLE public.goal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, shared_with_user_id)
);

-- Create goal_comments table for feedback
CREATE TABLE public.goal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goal_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_shares
CREATE POLICY "Goal owners can manage their shares"
  ON public.goal_shares FOR ALL
  USING (
    shared_by_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_shares.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can view their shares"
  ON public.goal_shares FOR SELECT
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Admins can view all shares"
  ON public.goal_shares FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for goal_comments
CREATE POLICY "Goal owners can view comments on their goals"
  ON public.goal_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_comments.goal_id
      AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can view comments on shared goals"
  ON public.goal_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_shares
      WHERE goal_shares.goal_id = goal_comments.goal_id
      AND goal_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments on goals they have access to"
  ON public.goal_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM public.goals
        WHERE goals.id = goal_comments.goal_id
        AND goals.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.goal_shares
        WHERE goal_shares.goal_id = goal_comments.goal_id
        AND goal_shares.shared_with_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON public.goal_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.goal_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all comments"
  ON public.goal_comments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Update goals table RLS to allow shared users to view goals
CREATE POLICY "Shared users can view goals shared with them"
  ON public.goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_shares
      WHERE goal_shares.goal_id = goals.id
      AND goal_shares.shared_with_user_id = auth.uid()
    )
  );

-- Update goal_milestones RLS to allow shared users to view milestones
CREATE POLICY "Shared users can view milestones of shared goals"
  ON public.goal_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_shares
      WHERE goal_shares.goal_id = goal_milestones.goal_id
      AND goal_shares.shared_with_user_id = auth.uid()
    )
  );