-- Drop the slow policies
DROP POLICY IF EXISTS "Clients can view sections linked to their module content" ON public.scenario_sections;
DROP POLICY IF EXISTS "Clients can view paragraphs linked to their module content" ON public.section_paragraphs;

-- Create an index to speed up the module content lookups
CREATE INDEX IF NOT EXISTS idx_module_client_content_scenarios_template 
ON public.module_client_content_scenarios(scenario_template_id);

CREATE INDEX IF NOT EXISTS idx_module_client_content_user 
ON public.module_client_content(user_id);

-- Create optimized policy for scenario_sections using a simpler approach
-- Clients can view sections if they have an assignment for that template
CREATE POLICY "Clients can view sections for their assignments"
ON public.scenario_sections
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM scenario_assignments sa
    WHERE sa.template_id = scenario_sections.template_id
      AND sa.user_id = auth.uid()
  )
);

-- Create optimized policy for section_paragraphs using assignment check
CREATE POLICY "Clients can view paragraphs for their assignments"
ON public.section_paragraphs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM scenario_sections ss
    JOIN scenario_assignments sa ON sa.template_id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
      AND sa.user_id = auth.uid()
  )
);