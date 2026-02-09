-- Add status to capability_snapshots for draft support
ALTER TABLE public.capability_snapshots
  ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'
  CHECK (status IN ('draft', 'completed'));

-- Update existing records to ensure completed status
UPDATE public.capability_snapshots
SET status = 'completed'
WHERE completed_at IS NOT NULL;

-- Create index for efficient draft queries
CREATE INDEX idx_capability_snapshots_user_draft 
  ON public.capability_snapshots(user_id, assessment_id, status)
  WHERE status = 'draft';

-- Users can update their own drafts
CREATE POLICY "Users can update their own drafts"
  ON public.capability_snapshots FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

-- Users can delete their own drafts
CREATE POLICY "Users can delete their own drafts"
  ON public.capability_snapshots FOR DELETE
  USING (user_id = auth.uid() AND status = 'draft');