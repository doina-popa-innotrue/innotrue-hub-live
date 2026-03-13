-- Fix: scenario_assignments UNIQUE constraint too narrow
--
-- The original UNIQUE(template_id, user_id, enrollment_id) prevents the same
-- scenario template from being assigned on different modules within the same
-- enrollment. It also conflicts with the resubmission feature (multiple
-- attempts for the same template+user+enrollment).
--
-- New constraint: UNIQUE(template_id, user_id, module_id, attempt_number)
-- This allows:
--   - Same template on different modules (different module_id)
--   - Resubmissions on the same module (different attempt_number)
-- while still preventing true duplicates.
--
-- Uses COALESCE for module_id since it's nullable — treats NULL as a
-- sentinel UUID so PostgreSQL enforces uniqueness even for NULL module_id rows.

-- 1. Drop the old constraint
ALTER TABLE scenario_assignments
  DROP CONSTRAINT IF EXISTS scenario_assignments_template_id_user_id_enrollment_id_key;

-- 2. Create new unique index that accounts for module + attempt
CREATE UNIQUE INDEX IF NOT EXISTS uq_scenario_assignments_template_user_module_attempt
  ON scenario_assignments(
    template_id,
    user_id,
    COALESCE(module_id, '00000000-0000-0000-0000-000000000000'::uuid),
    attempt_number
  );
