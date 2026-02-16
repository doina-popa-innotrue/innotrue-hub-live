-- M3: Add rubric_text to paragraph_question_links for scenario evaluation rubrics
ALTER TABLE paragraph_question_links ADD COLUMN IF NOT EXISTS rubric_text text;

COMMENT ON COLUMN paragraph_question_links.rubric_text IS 'Scoring rubric guidance for evaluators (e.g. "Score 5 if candidate demonstrates active listening AND provides structured feedback")';
