-- R1: Assessment Question Types & Weighted Scoring
-- Adds dynamic question type categorization and weighted scoring to capability assessments.
-- Backward compatible: all columns nullable, existing assessments unchanged.

-- 1. Add question_types config to capability_assessments
-- Stores assessment-level type definitions with weights.
-- Example: [{"name": "Knowledge", "weight": 30}, {"name": "Judgement", "weight": 50}, {"name": "Communication", "weight": 20}]
ALTER TABLE capability_assessments
  ADD COLUMN IF NOT EXISTS question_types jsonb DEFAULT NULL;

COMMENT ON COLUMN capability_assessments.question_types IS
  'Dynamic question type definitions with weights. Array of {name: string, weight: number}. Weights should sum to 100. NULL means no types (simple averaging).';

-- 2. Add question_type to capability_domain_questions
-- References one of the types defined in the parent assessment's question_types.
ALTER TABLE capability_domain_questions
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT NULL;

COMMENT ON COLUMN capability_domain_questions.question_type IS
  'Which question type this question belongs to (matches a name in capability_assessments.question_types). NULL = untyped.';

-- 3. Add type_weight override to capability_domain_questions
-- Optional per-question weight override within its type group.
ALTER TABLE capability_domain_questions
  ADD COLUMN IF NOT EXISTS type_weight numeric DEFAULT NULL;

COMMENT ON COLUMN capability_domain_questions.type_weight IS
  'Optional weight override for this question within its type group. NULL = equal weighting among questions of the same type.';
