-- =============================================================================
-- SC-6: RLS Performance — Supporting Composite Indexes
-- =============================================================================
-- Hot RLS functions (is_session_instructor_or_coach, user_has_feature) and
-- module_progress/module_assignments policies use multi-table JOINs that
-- benefit from composite indexes. The functions themselves are already optimal
-- (SECURITY DEFINER + STABLE + EXISTS short-circuit). Indexes are the fix.
-- =============================================================================

-- ── 1. is_session_instructor_or_coach() — 5-way UNION support ───────────────

-- Composite for 2 branches: session_module_links → program_modules → program_instructors
CREATE INDEX IF NOT EXISTS idx_program_instructors_program_instructor
  ON public.program_instructors(program_id, instructor_id);

-- Composite for 2 branches: session_group_links → groups → program_coaches
CREATE INDEX IF NOT EXISTS idx_program_coaches_program_coach
  ON public.program_coaches(program_id, coach_id);

-- Composite for coach lookup branch: session_participants → client_coaches
CREATE INDEX IF NOT EXISTS idx_session_participants_session_user
  ON public.session_participants(session_id, user_id);

-- ── 2. user_has_feature() — 4-way UNION ALL support ─────────────────────────

-- features(key) — every branch resolves feature_key to feature_id
CREATE INDEX IF NOT EXISTS idx_features_key
  ON public.features(key);

-- Branch 1: subscription plan features
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_feature
  ON public.plan_features(plan_id, feature_id);

-- Branch 3: add-on features
CREATE INDEX IF NOT EXISTS idx_user_add_ons_user_addon
  ON public.user_add_ons(user_id, add_on_id);

-- Branch 4: track features
CREATE INDEX IF NOT EXISTS idx_track_features_track_feature
  ON public.track_features(track_id, feature_id);

-- Branch 4: user tracks lookup
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_active
  ON public.user_tracks(user_id, is_active);

-- ── 3. module_assignments policies — double JOIN support ─────────────────────
-- Policies: module_progress → client_enrollments → client_coaches/client_instructors

CREATE INDEX IF NOT EXISTS idx_client_instructors_client_instructor
  ON public.client_instructors(client_id, instructor_id);

CREATE INDEX IF NOT EXISTS idx_client_coaches_client_coach
  ON public.client_coaches(client_id, coach_id);
