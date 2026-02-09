-- Create decision reminders table
CREATE TABLE decision_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_date DATE NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('short_term', 'medium_term', 'long_term', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE decision_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for decision reminders
CREATE POLICY "Users can view their own reminders"
  ON decision_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminders"
  ON decision_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
  ON decision_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON decision_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all reminders
CREATE POLICY "Admins can view all reminders"
  ON decision_reminders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient queries
CREATE INDEX idx_reminders_user_date ON decision_reminders(user_id, reminder_date);
CREATE INDEX idx_reminders_pending ON decision_reminders(reminder_date, is_completed, email_sent) WHERE NOT is_completed;

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;