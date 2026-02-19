-- Add bookmark and suspend_data columns to xapi_sessions for Rise content resume.
-- Rise uses SetBookmark/GetBookmark to save/restore the learner's scroll position,
-- and SetDataChunk/GetDataChunk to save/restore the full suspend data blob.

ALTER TABLE public.xapi_sessions
  ADD COLUMN IF NOT EXISTS bookmark TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS suspend_data TEXT DEFAULT '';

COMMENT ON COLUMN public.xapi_sessions.bookmark IS
  'SCORM cmi.core.lesson_location — Rise uses this for the learner scroll/page position';
COMMENT ON COLUMN public.xapi_sessions.suspend_data IS
  'SCORM cmi.suspend_data — Rise uses this for full course state (completed lessons, quiz answers, etc.)';
