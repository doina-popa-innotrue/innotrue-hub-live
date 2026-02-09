-- Add Slack channel URL column to groups table for group collaboration
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS slack_channel_url text;