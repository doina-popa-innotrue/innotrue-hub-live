-- Add locking capability to scenario templates

-- 1. Add lock columns to scenario_templates
ALTER TABLE public.scenario_templates
ADD COLUMN is_locked BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN locked_at TIMESTAMPTZ;

-- 2. Drop existing instructor/coach policies and recreate with lock check
DROP POLICY IF EXISTS "Instructors can manage scenario templates" ON public.scenario_templates;
DROP POLICY IF EXISTS "Coaches can manage scenario templates" ON public.scenario_templates;

-- Instructors can only manage unlocked templates
CREATE POLICY "Instructors can manage unlocked scenario templates"
ON public.scenario_templates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND is_locked = false
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  AND is_locked = false
);

-- Coaches can only manage unlocked templates
CREATE POLICY "Coaches can manage unlocked scenario templates"
ON public.scenario_templates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND is_locked = false
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  AND is_locked = false
);

-- 3. Update section policies to respect template lock
DROP POLICY IF EXISTS "Instructors can manage scenario sections" ON public.scenario_sections;
DROP POLICY IF EXISTS "Coaches can manage scenario sections" ON public.scenario_sections;

CREATE POLICY "Instructors can manage sections of unlocked templates"
ON public.scenario_sections FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.id = scenario_sections.template_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.id = scenario_sections.template_id
    AND st.is_locked = true
  )
);

CREATE POLICY "Coaches can manage sections of unlocked templates"
ON public.scenario_sections FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.id = scenario_sections.template_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.id = scenario_sections.template_id
    AND st.is_locked = true
  )
);

-- 4. Update paragraph policies to respect template lock
DROP POLICY IF EXISTS "Instructors can manage section paragraphs" ON public.section_paragraphs;
DROP POLICY IF EXISTS "Coaches can manage section paragraphs" ON public.section_paragraphs;

CREATE POLICY "Instructors can manage paragraphs of unlocked templates"
ON public.section_paragraphs FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_sections ss
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_sections ss
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
    AND st.is_locked = true
  )
);

CREATE POLICY "Coaches can manage paragraphs of unlocked templates"
ON public.section_paragraphs FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_sections ss
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.scenario_sections ss
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE ss.id = section_paragraphs.section_id
    AND st.is_locked = true
  )
);

-- 5. Update question link policies to respect template lock
DROP POLICY IF EXISTS "Instructors can manage paragraph question links" ON public.paragraph_question_links;
DROP POLICY IF EXISTS "Coaches can manage paragraph question links" ON public.paragraph_question_links;

CREATE POLICY "Instructors can manage question links of unlocked templates"
ON public.paragraph_question_links FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  AND NOT EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND st.is_locked = true
  )
);

CREATE POLICY "Coaches can manage question links of unlocked templates"
ON public.paragraph_question_links FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND st.is_locked = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  AND NOT EXISTS (
    SELECT 1 FROM public.section_paragraphs sp
    JOIN public.scenario_sections ss ON ss.id = sp.section_id
    JOIN public.scenario_templates st ON st.id = ss.template_id
    WHERE sp.id = paragraph_question_links.paragraph_id
    AND st.is_locked = true
  )
);

-- 6. Protect linked capability_assessments when template is locked
-- Add trigger to prevent updates to capability_assessments linked to locked templates
CREATE OR REPLACE FUNCTION public.prevent_locked_capability_assessment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this assessment is linked to any locked template
  IF EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.capability_assessment_id = OLD.id
    AND st.is_locked = true
  ) THEN
    -- Only admins can modify
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Cannot modify capability assessment linked to a locked scenario template';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_locked_capability_assessment
BEFORE UPDATE ON public.capability_assessments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_capability_assessment_changes();

-- 7. Also protect capability_domains and capability_domain_questions for locked assessments
CREATE OR REPLACE FUNCTION public.prevent_locked_domain_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this domain's assessment is linked to any locked template
  IF EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.capability_assessment_id = OLD.assessment_id
    AND st.is_locked = true
  ) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Cannot modify domain linked to a locked scenario template';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_locked_domain
BEFORE UPDATE OR DELETE ON public.capability_domains
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_domain_changes();

CREATE OR REPLACE FUNCTION public.prevent_locked_question_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment_id UUID;
BEGIN
  -- Get the assessment_id via the domain
  SELECT cd.assessment_id INTO v_assessment_id
  FROM public.capability_domains cd
  WHERE cd.id = OLD.domain_id;
  
  -- Check if this question's assessment is linked to any locked template
  IF EXISTS (
    SELECT 1 FROM public.scenario_templates st
    WHERE st.capability_assessment_id = v_assessment_id
    AND st.is_locked = true
  ) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Cannot modify question linked to a locked scenario template';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_locked_question
BEFORE UPDATE OR DELETE ON public.capability_domain_questions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_question_changes();

-- 8. Index for performance
CREATE INDEX idx_scenario_templates_locked ON public.scenario_templates(is_locked) WHERE is_locked = true;