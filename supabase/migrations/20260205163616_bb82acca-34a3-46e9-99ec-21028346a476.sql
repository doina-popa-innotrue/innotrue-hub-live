-- Allow clients to view scenario templates that are linked to their personalized module content
-- This enables them to see the title/description before starting the scenario
CREATE POLICY "Clients can view templates linked to their module content"
ON public.scenario_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM module_client_content_scenarios mccs
    JOIN module_client_content mcc ON mcc.id = mccs.module_client_content_id
    WHERE mccs.scenario_template_id = scenario_templates.id
      AND mcc.user_id = auth.uid()
  )
);