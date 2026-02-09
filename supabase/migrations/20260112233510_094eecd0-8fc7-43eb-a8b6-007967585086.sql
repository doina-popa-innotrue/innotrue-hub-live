-- Add status column to coach_module_feedback for draft/published visibility
-- Used by both coaches and instructors
ALTER TABLE public.coach_module_feedback 
ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' 
CHECK (status IN ('draft', 'published'));

-- Add index for filtering by status
CREATE INDEX idx_coach_module_feedback_status ON public.coach_module_feedback(status);

-- Add comment to clarify usage
COMMENT ON COLUMN public.coach_module_feedback.status IS 'draft = only visible to author (coach/instructor), published = visible to client';