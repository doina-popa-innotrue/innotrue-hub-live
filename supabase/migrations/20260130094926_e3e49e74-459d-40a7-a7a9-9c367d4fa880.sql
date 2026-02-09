-- Add timezone column to all session tables to store IANA timezone identifiers
ALTER TABLE public.module_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.group_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.cohort_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add index for faster timezone-based queries
CREATE INDEX IF NOT EXISTS idx_module_sessions_timezone ON public.module_sessions(timezone);
CREATE INDEX IF NOT EXISTS idx_group_sessions_timezone ON public.group_sessions(timezone);
CREATE INDEX IF NOT EXISTS idx_cohort_sessions_timezone ON public.cohort_sessions(timezone);