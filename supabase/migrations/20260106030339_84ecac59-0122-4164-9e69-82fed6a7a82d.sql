-- First, add new values to the goal_category enum (we cannot remove old values in use)
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'health_fitness';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'career_business';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'finances';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'relationships';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'personal_growth';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'fun_recreation';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'physical_environment';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'family_friends';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'romance';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'contribution';

-- Create wheel of life snapshots table
CREATE TABLE public.wheel_of_life_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  -- Standard 10 categories with ratings 1-10
  health_fitness INTEGER CHECK (health_fitness >= 1 AND health_fitness <= 10),
  career_business INTEGER CHECK (career_business >= 1 AND career_business <= 10),
  finances INTEGER CHECK (finances >= 1 AND finances <= 10),
  relationships INTEGER CHECK (relationships >= 1 AND relationships <= 10),
  personal_growth INTEGER CHECK (personal_growth >= 1 AND personal_growth <= 10),
  fun_recreation INTEGER CHECK (fun_recreation >= 1 AND fun_recreation <= 10),
  physical_environment INTEGER CHECK (physical_environment >= 1 AND physical_environment <= 10),
  family_friends INTEGER CHECK (family_friends >= 1 AND family_friends <= 10),
  romance INTEGER CHECK (romance >= 1 AND romance <= 10),
  contribution INTEGER CHECK (contribution >= 1 AND contribution <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wheel_of_life_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only see their own snapshots
CREATE POLICY "Users can view their own wheel snapshots"
ON public.wheel_of_life_snapshots
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own snapshots
CREATE POLICY "Users can create their own wheel snapshots"
ON public.wheel_of_life_snapshots
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own snapshots
CREATE POLICY "Users can update their own wheel snapshots"
ON public.wheel_of_life_snapshots
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own snapshots
CREATE POLICY "Users can delete their own wheel snapshots"
ON public.wheel_of_life_snapshots
FOR DELETE
USING (auth.uid() = user_id);

-- Coaches can view their clients' snapshots
CREATE POLICY "Coaches can view client wheel snapshots"
ON public.wheel_of_life_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_coaches cc
    WHERE cc.client_id = wheel_of_life_snapshots.user_id
    AND cc.coach_id = auth.uid()
  )
);

-- Admins can view all snapshots
CREATE POLICY "Admins can view all wheel snapshots"
ON public.wheel_of_life_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_wheel_snapshots_updated_at
BEFORE UPDATE ON public.wheel_of_life_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();