-- Create enums for goals system
CREATE TYPE public.goal_category AS ENUM (
  'family_home',
  'financial_career', 
  'mental_educational',
  'spiritual_ethical',
  'social_cultural',
  'physical_health'
);

CREATE TYPE public.goal_timeframe AS ENUM ('short', 'medium', 'long');
CREATE TYPE public.goal_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.goal_status AS ENUM ('not_started', 'in_progress', 'completed', 'paused');
CREATE TYPE public.milestone_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Create goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.goal_category NOT NULL,
  timeframe_type public.goal_timeframe NOT NULL,
  priority public.goal_priority NOT NULL DEFAULT 'medium',
  target_date DATE,
  status public.goal_status NOT NULL DEFAULT 'not_started',
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create goal_milestones table
CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.milestone_status NOT NULL DEFAULT 'not_started',
  due_date DATE,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goals
CREATE POLICY "Users can view their own goals"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all goals"
  ON public.goals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for goal_milestones
CREATE POLICY "Users can view milestones of their own goals"
  ON public.goal_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.goals
    WHERE goals.id = goal_milestones.goal_id
    AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert milestones for their own goals"
  ON public.goal_milestones FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.goals
    WHERE goals.id = goal_milestones.goal_id
    AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can update milestones of their own goals"
  ON public.goal_milestones FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.goals
    WHERE goals.id = goal_milestones.goal_id
    AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete milestones of their own goals"
  ON public.goal_milestones FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.goals
    WHERE goals.id = goal_milestones.goal_id
    AND goals.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all milestones"
  ON public.goal_milestones FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at on goals
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-calculate progress_percentage based on milestones
CREATE OR REPLACE FUNCTION public.update_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_milestones INTEGER;
  completed_milestones INTEGER;
  new_progress INTEGER;
  new_status goal_status;
  current_goal_status goal_status;
BEGIN
  -- Get current goal status
  SELECT status INTO current_goal_status
  FROM public.goals
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  -- Count total and completed milestones for the goal
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO total_milestones, completed_milestones
  FROM public.goal_milestones
  WHERE goal_id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  -- Calculate progress
  IF total_milestones > 0 THEN
    new_progress := (completed_milestones * 100 / total_milestones);
  ELSE
    new_progress := 0;
  END IF;
  
  -- Determine new status (only if current status is not paused)
  IF current_goal_status != 'paused' THEN
    IF completed_milestones = total_milestones AND total_milestones > 0 THEN
      new_status := 'completed';
    ELSIF completed_milestones > 0 THEN
      new_status := 'in_progress';
    ELSE
      new_status := 'not_started';
    END IF;
  ELSE
    new_status := current_goal_status;
  END IF;
  
  -- Update the goal
  UPDATE public.goals
  SET 
    progress_percentage = new_progress,
    status = new_status
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update goal progress when milestones change
CREATE TRIGGER update_goal_progress_on_milestone_change
  AFTER INSERT OR UPDATE OR DELETE ON public.goal_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_goal_progress();