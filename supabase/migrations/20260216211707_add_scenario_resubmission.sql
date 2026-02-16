-- M5: Configurable scenario re-submission (new attempt model)

-- Per-template toggle for whether re-submission is allowed
ALTER TABLE scenario_templates
  ADD COLUMN IF NOT EXISTS allows_resubmission boolean NOT NULL DEFAULT false;

-- Link new attempts to the previous one, track attempt number and revision notes
ALTER TABLE scenario_assignments
  ADD COLUMN IF NOT EXISTS parent_assignment_id uuid REFERENCES scenario_assignments(id),
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_notes text;

COMMENT ON COLUMN scenario_templates.allows_resubmission IS 'When true, instructors can request clients to revise and resubmit evaluated scenarios';
COMMENT ON COLUMN scenario_assignments.parent_assignment_id IS 'Links to the previous attempt (NULL for first attempt)';
COMMENT ON COLUMN scenario_assignments.attempt_number IS 'Attempt number (1 for first, 2 for first revision, etc.)';
COMMENT ON COLUMN scenario_assignments.revision_notes IS 'Instructor notes on what to revise (set when creating a revision)';
