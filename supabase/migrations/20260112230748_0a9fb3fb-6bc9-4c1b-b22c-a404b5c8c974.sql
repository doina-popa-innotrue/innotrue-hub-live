-- 1. Create assessment_categories lookup table (dynamic, admin-managed)
CREATE TABLE public.assessment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assessment_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read active categories
CREATE POLICY "Anyone can view active assessment categories"
  ON public.assessment_categories FOR SELECT
  USING (is_active = true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage assessment categories"
  ON public.assessment_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Seed initial categories
INSERT INTO public.assessment_categories (name, description, order_index) VALUES
  ('capability', 'Technical and professional capability assessments', 1),
  ('leadership', 'Leadership style and competency assessments', 2),
  ('values', 'Personal values and alignment assessments', 3);

-- 2. Add category_id to capability_assessments
ALTER TABLE public.capability_assessments
  ADD COLUMN category_id UUID REFERENCES public.assessment_categories(id);

-- Set existing assessments to 'capability' category
UPDATE public.capability_assessments
SET category_id = (SELECT id FROM public.assessment_categories WHERE name = 'capability');

-- 3. Add input_type to capability_domain_questions (default to slider for existing)
ALTER TABLE public.capability_domain_questions
  ADD COLUMN input_type TEXT NOT NULL DEFAULT 'slider'
  CHECK (input_type IN ('slider', 'single_choice', 'multi_choice', 'text'));

-- Add options column for choice-based questions (JSON array of options)
ALTER TABLE public.capability_domain_questions
  ADD COLUMN options JSONB;

-- 4. Create question-level notes table
CREATE TABLE public.capability_question_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.capability_snapshots(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, question_id)
);

-- Enable RLS
ALTER TABLE public.capability_question_notes ENABLE ROW LEVEL SECURITY;

-- Users can manage their own question notes
CREATE POLICY "Users can view their own question notes"
  ON public.capability_question_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own question notes"
  ON public.capability_question_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own question notes"
  ON public.capability_question_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own question notes"
  ON public.capability_question_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.user_id = auth.uid()
    )
  );

-- Coaches can view shared question notes
CREATE POLICY "Coaches can view shared question notes"
  ON public.capability_question_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      JOIN public.client_coaches cc ON cc.client_id = cs.user_id
      WHERE cs.id = capability_question_notes.snapshot_id
        AND cc.coach_id = auth.uid()
        AND cs.shared_with_coach = true
    )
  );

-- 5. Add evaluator support to snapshots
ALTER TABLE public.capability_snapshots
  ADD COLUMN is_self_assessment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN evaluator_id UUID REFERENCES public.profiles(id),
  ADD COLUMN evaluation_relationship TEXT;

-- Add constraint: evaluator_id required when not self-assessment
ALTER TABLE public.capability_snapshots
  ADD CONSTRAINT evaluator_required_for_external
  CHECK (is_self_assessment = true OR evaluator_id IS NOT NULL);

-- Evaluators can view/manage their evaluations
CREATE POLICY "Evaluators can view their evaluations"
  ON public.capability_snapshots FOR SELECT
  USING (evaluator_id = auth.uid());

CREATE POLICY "Evaluators can insert evaluations"
  ON public.capability_snapshots FOR INSERT
  WITH CHECK (evaluator_id = auth.uid() AND is_self_assessment = false);

CREATE POLICY "Evaluators can update their evaluations"
  ON public.capability_snapshots FOR UPDATE
  USING (evaluator_id = auth.uid() AND is_self_assessment = false);

-- Evaluators can manage ratings on their evaluations
CREATE POLICY "Evaluators can view their evaluation ratings"
  ON public.capability_snapshot_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_snapshot_ratings.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can insert their evaluation ratings"
  ON public.capability_snapshot_ratings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_snapshot_ratings.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can update their evaluation ratings"
  ON public.capability_snapshot_ratings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_snapshot_ratings.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

-- Evaluators can manage domain notes on their evaluations
CREATE POLICY "Evaluators can view their evaluation domain notes"
  ON public.capability_domain_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_domain_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can insert their evaluation domain notes"
  ON public.capability_domain_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_domain_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can update their evaluation domain notes"
  ON public.capability_domain_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_domain_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

-- Evaluators can manage question notes on their evaluations
CREATE POLICY "Evaluators can view their evaluation question notes"
  ON public.capability_question_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can insert their evaluation question notes"
  ON public.capability_question_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

CREATE POLICY "Evaluators can update their evaluation question notes"
  ON public.capability_question_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots
      WHERE capability_snapshots.id = capability_question_notes.snapshot_id
        AND capability_snapshots.evaluator_id = auth.uid()
    )
  );

-- Trigger for updated_at on new tables
CREATE TRIGGER update_assessment_categories_updated_at
  BEFORE UPDATE ON public.assessment_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_question_notes_updated_at
  BEFORE UPDATE ON public.capability_question_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();