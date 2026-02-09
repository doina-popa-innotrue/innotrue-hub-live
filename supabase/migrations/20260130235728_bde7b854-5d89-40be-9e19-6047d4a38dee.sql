-- Create table for user external calendar feeds
CREATE TABLE public.user_external_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ical_url TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_external_calendars ENABLE ROW LEVEL SECURITY;

-- Users can manage their own calendars
CREATE POLICY "Users can view their own external calendars"
  ON public.user_external_calendars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external calendars"
  ON public.user_external_calendars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external calendars"
  ON public.user_external_calendars FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external calendars"
  ON public.user_external_calendars FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_external_calendars_updated_at
  BEFORE UPDATE ON public.user_external_calendars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();