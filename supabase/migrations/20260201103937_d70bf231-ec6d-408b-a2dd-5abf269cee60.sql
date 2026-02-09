-- Fix the module_sessions status check constraint to include all valid statuses
ALTER TABLE public.module_sessions DROP CONSTRAINT IF EXISTS module_sessions_status_check;
ALTER TABLE public.module_sessions ADD CONSTRAINT module_sessions_status_check 
  CHECK (status IN ('draft', 'scheduled', 'requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled'));