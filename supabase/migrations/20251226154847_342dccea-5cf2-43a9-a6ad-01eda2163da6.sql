-- Add recurrence fields to group_sessions table
ALTER TABLE public.group_sessions
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_pattern text CHECK (recurrence_pattern IN ('weekly', 'bi-weekly', 'monthly')),
ADD COLUMN recurrence_end_date date;