-- Optimize RLS on section_paragraphs and paragraph_question_links.
--
-- Problem: FOR ALL policies evaluate expensive subqueries (lock checks, assignment joins)
-- even during SELECT. PostgreSQL evaluates ALL policies independently (OR'd), so the
-- expensive checks run per-row even when a simple admin check passes.
--
-- Fix: Split into separate SELECT and write policies. SELECT uses a single policy with
-- SQL-level OR short-circuiting (admin checked first, expensive checks last).
-- Write policies keep the lock enforcement for instructor/coach.

-- ============================================================================
-- Helper: check if caller can write to a section_paragraph (used by write policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_write_section_paragraph(p_section_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin: unrestricted
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      -- Instructor / Coach: only unlocked templates
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('instructor', 'coach'))
      AND NOT EXISTS (
        SELECT 1 FROM scenario_sections ss
        JOIN scenario_templates st ON st.id = ss.template_id
        WHERE ss.id = p_section_id AND st.is_locked = true
      )
    )
$$;

-- Helper: check if caller can write to a paragraph_question_link
CREATE OR REPLACE FUNCTION public.can_write_question_link(p_paragraph_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('instructor', 'coach'))
      AND NOT EXISTS (
        SELECT 1 FROM section_paragraphs sp
        JOIN scenario_sections ss ON ss.id = sp.section_id
        JOIN scenario_templates st ON st.id = ss.template_id
        WHERE sp.id = p_paragraph_id AND st.is_locked = true
      )
    )
$$;

-- ============================================================================
-- section_paragraphs: replace policies
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can manage section paragraphs" ON public.section_paragraphs;
DROP POLICY IF EXISTS "Instructors can manage paragraphs of unlocked templates" ON public.section_paragraphs;
DROP POLICY IF EXISTS "Coaches can manage paragraphs of unlocked templates" ON public.section_paragraphs;
DROP POLICY IF EXISTS "Clients can view paragraphs for their assignments" ON public.section_paragraphs;

-- SELECT: single policy with SQL OR short-circuiting (cheap checks first)
CREATE POLICY "section_paragraphs_select"
ON public.section_paragraphs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'instructor')
  OR public.has_role(auth.uid(), 'coach')
  OR public.user_can_access_paragraph(section_id)
);

-- INSERT / UPDATE / DELETE: use helper function (checks role + lock)
CREATE POLICY "section_paragraphs_insert"
ON public.section_paragraphs FOR INSERT TO authenticated
WITH CHECK (public.can_write_section_paragraph(section_id));

CREATE POLICY "section_paragraphs_update"
ON public.section_paragraphs FOR UPDATE TO authenticated
USING (public.can_write_section_paragraph(section_id))
WITH CHECK (public.can_write_section_paragraph(section_id));

CREATE POLICY "section_paragraphs_delete"
ON public.section_paragraphs FOR DELETE TO authenticated
USING (public.can_write_section_paragraph(section_id));

-- ============================================================================
-- paragraph_question_links: replace policies
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can manage paragraph question links" ON public.paragraph_question_links;
DROP POLICY IF EXISTS "Instructors can manage question links of unlocked templates" ON public.paragraph_question_links;
DROP POLICY IF EXISTS "Coaches can manage question links of unlocked templates" ON public.paragraph_question_links;
DROP POLICY IF EXISTS "Clients can view paragraph question links for assigned templates" ON public.paragraph_question_links;

-- SELECT: single policy with SQL OR short-circuiting
CREATE POLICY "question_links_select"
ON public.paragraph_question_links FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'instructor')
  OR public.has_role(auth.uid(), 'coach')
  OR EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_assignments sa ON sa.template_id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND sa.user_id = auth.uid()
  )
);

-- INSERT / UPDATE / DELETE: use helper function
CREATE POLICY "question_links_insert"
ON public.paragraph_question_links FOR INSERT TO authenticated
WITH CHECK (public.can_write_question_link(paragraph_id));

CREATE POLICY "question_links_update"
ON public.paragraph_question_links FOR UPDATE TO authenticated
USING (public.can_write_question_link(paragraph_id))
WITH CHECK (public.can_write_question_link(paragraph_id));

CREATE POLICY "question_links_delete"
ON public.paragraph_question_links FOR DELETE TO authenticated
USING (public.can_write_question_link(paragraph_id));
