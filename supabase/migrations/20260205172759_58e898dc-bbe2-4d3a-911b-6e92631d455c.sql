-- Allow clients to view sections of templates linked to their module content
CREATE POLICY "Clients can view sections linked to their module content"
ON public.scenario_sections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM module_client_content_scenarios mccs
    JOIN module_client_content mcc ON mcc.id = mccs.module_client_content_id
    WHERE mccs.scenario_template_id = scenario_sections.template_id
      AND mcc.user_id = auth.uid()
  )
);

-- Allow clients to view paragraphs of templates linked to their module content
CREATE POLICY "Clients can view paragraphs linked to their module content"
ON public.section_paragraphs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM scenario_sections ss
    JOIN module_client_content_scenarios mccs ON mccs.scenario_template_id = ss.template_id
    JOIN module_client_content mcc ON mcc.id = mccs.module_client_content_id
    WHERE ss.id = section_paragraphs.section_id
      AND mcc.user_id = auth.uid()
  )
);