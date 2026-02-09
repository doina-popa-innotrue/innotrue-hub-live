-- Add option_id to tasks to link tasks to specific decision options
ALTER TABLE tasks ADD COLUMN option_id UUID REFERENCES decision_options(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_tasks_option_id ON tasks(option_id);

-- Update RLS policies to ensure tasks linked to options are properly secured
-- (existing policies should already cover this via decision_id, but let's be explicit)