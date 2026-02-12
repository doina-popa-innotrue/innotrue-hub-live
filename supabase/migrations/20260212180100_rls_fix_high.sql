-- =============================================================================
-- Migration: RLS Fix — HIGH Priority
-- =============================================================================
-- Fixes functional gaps and security concerns from RLS audit (2026-02-12)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1  notifications — Admin can't see other users' notifications
--      NotificationsManagement.tsx queries all notifications but only
--      user_id = auth.uid() policy exists.
-- ---------------------------------------------------------------------------

CREATE POLICY "Admins can view all notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 2.2  email_queue — Admin DELETE missing
--      EmailQueueManagement.tsx performs .delete() but only SELECT + UPDATE
--      policies exist for admins.
-- ---------------------------------------------------------------------------

CREATE POLICY "Admins can delete email queue items"
  ON public.email_queue
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- 2.3  module_client_content_resources — Staff policies too broad
--      Any instructor/coach can manage ALL clients' resources. Should be
--      scoped via staff_has_client_relationship.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Instructors can manage client content resources" ON public.module_client_content_resources;
DROP POLICY IF EXISTS "Coaches can manage client content resources" ON public.module_client_content_resources;

CREATE POLICY "Instructors can manage content resources for their clients"
  ON public.module_client_content_resources
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND EXISTS (
      SELECT 1 FROM module_client_content mcc
      WHERE mcc.id = module_client_content_resources.module_client_content_id
        AND staff_has_client_relationship(auth.uid(), mcc.user_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'instructor'::app_role)
    AND EXISTS (
      SELECT 1 FROM module_client_content mcc
      WHERE mcc.id = module_client_content_resources.module_client_content_id
        AND staff_has_client_relationship(auth.uid(), mcc.user_id)
    )
  );

CREATE POLICY "Coaches can manage content resources for their clients"
  ON public.module_client_content_resources
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    AND EXISTS (
      SELECT 1 FROM module_client_content mcc
      WHERE mcc.id = module_client_content_resources.module_client_content_id
        AND staff_has_client_relationship(auth.uid(), mcc.user_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'coach'::app_role)
    AND EXISTS (
      SELECT 1 FROM module_client_content mcc
      WHERE mcc.id = module_client_content_resources.module_client_content_id
        AND staff_has_client_relationship(auth.uid(), mcc.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2.4  scenario_assignments — Client DELETE missing
--      useScenarioAssignments.ts performs .delete() but clients only have
--      SELECT/INSERT/UPDATE. Allow delete for draft/submitted only.
-- ---------------------------------------------------------------------------

CREATE POLICY "Clients can delete own draft assignments"
  ON public.scenario_assignments
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- ---------------------------------------------------------------------------
-- 2.5  module_scenarios — Staff missing write access
--      Frontend hook does INSERT/UPDATE/DELETE but only admin has write.
--      Add instructor/coach write scoped to their programs.
-- ---------------------------------------------------------------------------

CREATE POLICY "Instructors can manage module scenarios for their programs"
  ON public.module_scenarios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN program_instructors pi ON pi.program_id = pm.program_id
      WHERE pm.id = module_scenarios.module_id
        AND pi.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN program_instructors pi ON pi.program_id = pm.program_id
      WHERE pm.id = module_scenarios.module_id
        AND pi.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage module scenarios for their programs"
  ON public.module_scenarios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN program_coaches pc ON pc.program_id = pm.program_id
      WHERE pm.id = module_scenarios.module_id
        AND pc.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN program_coaches pc ON pc.program_id = pm.program_id
      WHERE pm.id = module_scenarios.module_id
        AND pc.coach_id = auth.uid()
    )
  );
