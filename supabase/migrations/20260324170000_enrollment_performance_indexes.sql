-- =============================================================================
-- Migration: Enrollment system performance indexes
-- =============================================================================
-- Adds missing critical indexes for enrollment queries, RLS policies,
-- and module progress lookups. These are the most frequently queried
-- columns that currently have NO indexes.
-- =============================================================================

-- Core enrollment lookups
CREATE INDEX IF NOT EXISTS idx_client_enrollments_client_user_id
  ON public.client_enrollments(client_user_id);

CREATE INDEX IF NOT EXISTS idx_client_enrollments_program_id
  ON public.client_enrollments(program_id);

CREATE INDEX IF NOT EXISTS idx_client_enrollments_status
  ON public.client_enrollments(status);

-- Composite for "my active enrollments" (dashboard, client views)
CREATE INDEX IF NOT EXISTS idx_client_enrollments_client_status
  ON public.client_enrollments(client_user_id, status);

-- Ordering for admin list (pagination)
CREATE INDEX IF NOT EXISTS idx_client_enrollments_created_at_desc
  ON public.client_enrollments(created_at DESC);

-- RLS policy support (staff access uses correlated subqueries on these)
CREATE INDEX IF NOT EXISTS idx_program_instructors_instructor
  ON public.program_instructors(instructor_id);

CREATE INDEX IF NOT EXISTS idx_program_coaches_coach
  ON public.program_coaches(coach_id);

-- Module progress queries per enrollment
CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment
  ON public.module_progress(enrollment_id);
