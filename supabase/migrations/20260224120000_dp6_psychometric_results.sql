-- DP6: Psychometric Structured Results
-- Adds tables for defining dimension schemas per assessment type
-- and storing structured scores (manual entry of DISC, VIA, MBTI, etc.)

-- ============================================
-- 1. psychometric_result_schemas
-- ============================================
CREATE TABLE IF NOT EXISTS public.psychometric_result_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.psychometric_assessments(id) ON DELETE CASCADE,
  dimensions JSONB NOT NULL DEFAULT '[]',
  -- dimensions: [{"key":"D","label":"Dominance","min":0,"max":100}, ...]
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_psychometric_result_schemas_assessment
  ON public.psychometric_result_schemas(assessment_id);

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_psychometric_result_schemas_updated_at
  BEFORE UPDATE ON public.psychometric_result_schemas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.psychometric_result_schemas ENABLE ROW LEVEL SECURITY;

-- Admin full CRUD
CREATE POLICY "Admin full access to result schemas"
  ON public.psychometric_result_schemas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Staff/coach/instructor SELECT
CREATE POLICY "Staff and coaches can view result schemas"
  ON public.psychometric_result_schemas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('staff', 'coach', 'instructor')
    )
  );

-- Clients SELECT (need to see schemas to enter their own scores)
CREATE POLICY "Clients can view result schemas"
  ON public.psychometric_result_schemas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'client'
    )
  );

-- ============================================
-- 2. psychometric_results
-- ============================================
CREATE TABLE IF NOT EXISTS public.psychometric_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.psychometric_assessments(id) ON DELETE CASCADE,
  schema_id UUID NOT NULL REFERENCES public.psychometric_result_schemas(id) ON DELETE RESTRICT,
  user_assessment_id UUID REFERENCES public.user_assessments(id) ON DELETE SET NULL,
  scores JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"D": 85, "I": 42, "S": 28, "C": 65}
  entered_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  source_description TEXT,
  notes TEXT,
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_psychometric_results_user_assessment
  ON public.psychometric_results(user_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_psychometric_results_schema
  ON public.psychometric_results(schema_id);

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_psychometric_results_updated_at
  BEFORE UPDATE ON public.psychometric_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.psychometric_results ENABLE ROW LEVEL SECURITY;

-- Admin full CRUD
CREATE POLICY "Admin full access to psychometric results"
  ON public.psychometric_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view own results
CREATE POLICY "Users can view own psychometric results"
  ON public.psychometric_results
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert own results (self-entry)
CREATE POLICY "Users can insert own psychometric results"
  ON public.psychometric_results
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND entered_by = auth.uid());

-- Staff/coach/instructor can view their clients' results
CREATE POLICY "Staff and coaches can view client psychometric results"
  ON public.psychometric_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('staff', 'coach', 'instructor')
    )
  );

-- Coach/instructor can insert results for their clients
CREATE POLICY "Coaches can insert psychometric results for clients"
  ON public.psychometric_results
  FOR INSERT
  WITH CHECK (
    entered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('coach', 'instructor', 'staff')
    )
  );

-- Coach/instructor can update results they entered
CREATE POLICY "Coaches can update psychometric results they entered"
  ON public.psychometric_results
  FOR UPDATE
  USING (
    entered_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('coach', 'instructor', 'staff', 'admin')
    )
  );
