-- One-time cleanup: delete draft scenario_assignments where a non-draft
-- assignment already exists for the same (template_id, user_id).
-- These duplicates accumulated from repeated "Start Scenario" clicks
-- before the find-or-reuse logic was added (commit 35c99e9).

DELETE FROM public.scenario_assignments sa
WHERE sa.status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM public.scenario_assignments other
    WHERE other.template_id = sa.template_id
      AND other.user_id = sa.user_id
      AND other.id != sa.id
      AND other.status != 'draft'
  );
