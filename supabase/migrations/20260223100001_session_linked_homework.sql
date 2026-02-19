-- G10: Session-linked homework — link development_items to cohort sessions

-- Add session link column to development_items
ALTER TABLE public.development_items
  ADD COLUMN IF NOT EXISTS cohort_session_id UUID REFERENCES public.cohort_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_development_items_cohort_session_id
  ON public.development_items(cohort_session_id)
  WHERE cohort_session_id IS NOT NULL;

COMMENT ON COLUMN public.development_items.cohort_session_id IS
  'Optional link to a cohort session — makes this item "homework" for that session';
