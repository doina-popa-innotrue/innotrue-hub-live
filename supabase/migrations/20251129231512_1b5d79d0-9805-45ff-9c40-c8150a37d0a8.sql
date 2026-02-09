-- Drop existing constraints and update goals table structure
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_status_check;
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_timeframe_type_check;
ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_priority_check;

-- Update goals table to match new requirements
ALTER TABLE public.goals 
  ALTER COLUMN status TYPE TEXT,
  ALTER COLUMN timeframe_type TYPE TEXT,
  ALTER COLUMN priority TYPE TEXT;

-- Add new constraints
ALTER TABLE public.goals 
  ADD CONSTRAINT goals_status_check CHECK (status IN ('active', 'on_hold', 'retired', 'completed'));

ALTER TABLE public.goals 
  ADD CONSTRAINT goals_timeframe_type_check CHECK (timeframe_type IN ('short_term', 'medium_term', 'long_term'));

ALTER TABLE public.goals 
  ADD CONSTRAINT goals_priority_check CHECK (priority IN ('low', 'medium', 'high'));

-- Update default status
ALTER TABLE public.goals ALTER COLUMN status SET DEFAULT 'active';

-- Drop and recreate goal_milestones status constraint
ALTER TABLE public.goal_milestones DROP CONSTRAINT IF EXISTS goal_milestones_status_check;
ALTER TABLE public.goal_milestones ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.goal_milestones 
  ADD CONSTRAINT goal_milestones_status_check CHECK (status IN ('not_started', 'in_progress', 'completed'));

-- Create goal_reflections table
CREATE TABLE IF NOT EXISTS public.goal_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create goal_resources table
CREATE TABLE IF NOT EXISTS public.goal_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('image', 'pdf', 'link', 'other')),
  url TEXT,
  file_path TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.goal_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_resources ENABLE ROW LEVEL SECURITY;

-- RLS policies for goal_reflections
CREATE POLICY "Users can view their own goal reflections"
  ON public.goal_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal reflections"
  ON public.goal_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal reflections"
  ON public.goal_reflections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal reflections"
  ON public.goal_reflections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all goal reflections"
  ON public.goal_reflections FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for goal_resources
CREATE POLICY "Users can view their own goal resources"
  ON public.goal_resources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal resources"
  ON public.goal_resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal resources"
  ON public.goal_resources FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal resources"
  ON public.goal_resources FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all goal resources"
  ON public.goal_resources FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Update the trigger function for auto-calculating progress
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
  new_status TEXT;
  current_goal_status TEXT;
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
  
  -- Determine new status (only if current status is active or in_progress)
  IF current_goal_status IN ('active', 'in_progress') THEN
    IF completed_milestones = total_milestones AND total_milestones > 0 THEN
      new_status := 'completed';
    ELSIF completed_milestones > 0 THEN
      new_status := 'active';
    ELSE
      new_status := current_goal_status;
    END IF;
  ELSE
    new_status := current_goal_status;
  END IF;
  
  -- Update the goal
  UPDATE public.goals
  SET 
    progress_percentage = new_progress,
    status = new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.goal_id, OLD.goal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for updated_at on goal_reflections
CREATE TRIGGER update_goal_reflections_updated_at
  BEFORE UPDATE ON public.goal_reflections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();