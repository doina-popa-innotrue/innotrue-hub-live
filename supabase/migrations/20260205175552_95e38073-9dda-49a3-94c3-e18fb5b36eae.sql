-- Drop the slow policy
DROP POLICY IF EXISTS "Clients can view paragraphs for their assignments" ON public.section_paragraphs;

-- Add indexes to speed up the joins
CREATE INDEX IF NOT EXISTS idx_section_paragraphs_section_id 
ON public.section_paragraphs(section_id);

CREATE INDEX IF NOT EXISTS idx_scenario_sections_template_id 
ON public.scenario_sections(template_id);

CREATE INDEX IF NOT EXISTS idx_scenario_assignments_user_template 
ON public.scenario_assignments(user_id, template_id);

-- Create a security definer function to check paragraph access
-- This avoids RLS overhead during the check
CREATE OR REPLACE FUNCTION public.user_can_access_paragraph(p_section_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM scenario_sections ss
    JOIN scenario_assignments sa ON sa.template_id = ss.template_id
    WHERE ss.id = p_section_id
      AND sa.user_id = auth.uid()
  )
$$;

-- Create optimized policy using the security definer function
CREATE POLICY "Clients can view paragraphs for their assignments"
ON public.section_paragraphs
FOR SELECT
TO authenticated
USING (
  public.user_can_access_paragraph(section_id)
);