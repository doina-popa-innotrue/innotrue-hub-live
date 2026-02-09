-- Add sharing column to wheel_of_life_snapshots
ALTER TABLE public.wheel_of_life_snapshots 
ADD COLUMN shared_with_coach BOOLEAN NOT NULL DEFAULT false;

-- Update the coaches policy to only allow viewing shared snapshots
DROP POLICY IF EXISTS "Coaches can view client wheel snapshots" ON public.wheel_of_life_snapshots;

CREATE POLICY "Coaches can view shared client wheel snapshots"
ON public.wheel_of_life_snapshots
FOR SELECT
USING (
  shared_with_coach = true
  AND EXISTS (
    SELECT 1 FROM client_coaches cc
    WHERE cc.client_id = wheel_of_life_snapshots.user_id
    AND cc.coach_id = auth.uid()
  )
);