-- =============================================================================
-- Migration: SC-1 Critical Missing Indexes
-- =============================================================================
-- Adds indexes identified in the scalability & performance audit (2026-03-24).
-- These tables are queried on hot paths but lacked indexes on their most
-- frequently filtered columns, causing sequential scans.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. module_assignments — queried from Assignments.tsx, PendingAssignments.tsx
--    Only had idx on scoring_snapshot_id. Missing all filter/sort columns.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_module_assignments_module_progress_id
  ON public.module_assignments(module_progress_id);

CREATE INDEX IF NOT EXISTS idx_module_assignments_status
  ON public.module_assignments(status);

CREATE INDEX IF NOT EXISTS idx_module_assignments_status_updated
  ON public.module_assignments(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_assignments_scored_at
  ON public.module_assignments(scored_at DESC)
  WHERE scored_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. module_sessions — queried from Calendar.tsx, ModuleSessionManager.tsx
--    Had UNIQUE partial index on (module_id, enrollment_id) WHERE status != cancelled
--    but no standalone indexes for individual column lookups.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_module_sessions_module_id
  ON public.module_sessions(module_id);

CREATE INDEX IF NOT EXISTS idx_module_sessions_enrollment_id
  ON public.module_sessions(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_module_sessions_session_date
  ON public.module_sessions(session_date);

-- ---------------------------------------------------------------------------
-- 3. capability_assessments — queried from client assessment pages, RLS policies
--    No indexes on any filter columns.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_capability_assessments_is_active
  ON public.capability_assessments(is_active);

CREATE INDEX IF NOT EXISTS idx_capability_assessments_program_id
  ON public.capability_assessments(program_id);

CREATE INDEX IF NOT EXISTS idx_capability_assessments_slug
  ON public.capability_assessments(slug);

-- ---------------------------------------------------------------------------
-- 4. assessment_responses — queried from MyAssessments.tsx by user_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user_id
  ON public.assessment_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment_id
  ON public.assessment_responses(assessment_id);

-- ---------------------------------------------------------------------------
-- 5. assessment_questions — queried from AssessmentBuilderDetail.tsx
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id
  ON public.assessment_questions(assessment_id);

-- ---------------------------------------------------------------------------
-- 6. module_progress — already has idx on enrollment_id (via 20260324170000)
--    Missing module_id and composite (enrollment_id, module_id) for
--    per-module progress lookups and RLS policy support.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_module_progress_module_id
  ON public.module_progress(module_id);

CREATE INDEX IF NOT EXISTS idx_module_progress_enrollment_module
  ON public.module_progress(enrollment_id, module_id);

-- ---------------------------------------------------------------------------
-- 7. calcom_webhook_logs — used in cleanup queries, no index on created_at
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_calcom_webhook_logs_created_at
  ON public.calcom_webhook_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. user_credit_transactions — has individual indexes on user_id and
--    transaction_type but missing composite for the most common pattern:
--    "fetch recent transactions for a user"
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_credit_transactions_user_created
  ON public.user_credit_transactions(user_id, created_at DESC);
