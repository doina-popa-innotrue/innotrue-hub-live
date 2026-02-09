-- Add capacity fields to programs scheduled_dates (we'll update the JSONB structure)
-- The scheduled_dates will now include: {id, date, title, capacity, enrolled_count}

-- Create waiting list table for fully booked sessions
CREATE TABLE IF NOT EXISTS public.program_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  scheduled_date_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, program_id, scheduled_date_id)
);

-- Enable RLS
ALTER TABLE public.program_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_waitlist
CREATE POLICY "Users can view their own waitlist entries"
  ON public.program_waitlist
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own waitlist entries"
  ON public.program_waitlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own waitlist entries"
  ON public.program_waitlist
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all waitlist entries"
  ON public.program_waitlist
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at on program_waitlist
CREATE TRIGGER update_program_waitlist_updated_at
  BEFORE UPDATE ON public.program_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add reminder_sent field to program_interest_registrations
ALTER TABLE public.program_interest_registrations
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Enable realtime for interest registrations
ALTER TABLE public.program_interest_registrations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_interest_registrations;

-- Enable realtime for waitlist
ALTER TABLE public.program_waitlist REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.program_waitlist;