-- Create program_favorites table for bookmarking programs
CREATE TABLE IF NOT EXISTS public.program_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Enable RLS
ALTER TABLE public.program_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_favorites
CREATE POLICY "Users can view their own favorites"
  ON public.program_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON public.program_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.program_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all favorites"
  ON public.program_favorites
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create program_interest_registrations table for pre-enrollment interest
CREATE TABLE IF NOT EXISTS public.program_interest_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  enrollment_timeframe TEXT NOT NULL CHECK (enrollment_timeframe IN ('asap', '1-3_months')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enrolled', 'declined')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Enable RLS
ALTER TABLE public.program_interest_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_interest_registrations
CREATE POLICY "Users can view their own interest registrations"
  ON public.program_interest_registrations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interest registrations"
  ON public.program_interest_registrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interest registrations"
  ON public.program_interest_registrations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all interest registrations"
  ON public.program_interest_registrations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at on program_interest_registrations
CREATE TRIGGER update_program_interest_registrations_updated_at
  BEFORE UPDATE ON public.program_interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to notify admins of new interest registrations
CREATE OR REPLACE FUNCTION public.notify_interest_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  program_name text;
  user_name text;
  user_email text;
  admin_email text;
  timeframe_text text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Get program name
  SELECT name INTO program_name
  FROM public.programs
  WHERE id = NEW.program_id;
  
  -- Get user details
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  -- Format timeframe
  timeframe_text := CASE NEW.enrollment_timeframe
    WHEN 'asap' THEN 'As Soon As Possible'
    WHEN '1-3_months' THEN '1-3 Months'
    ELSE NEW.enrollment_timeframe
  END;
  
  -- Send notification to all admins
  FOR admin_email IN
    SELECT au.email
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE ur.role = 'admin'
  LOOP
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'email', admin_email,
        'name', 'Admin',
        'type', 'program_interest_registration',
        'timestamp', NEW.created_at,
        'userName', COALESCE(user_name, 'User'),
        'userEmail', user_email,
        'programName', program_name,
        'enrollmentTimeframe', timeframe_text,
        'entityLink', supabase_url || '/admin/clients'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for new interest registrations
CREATE TRIGGER notify_new_interest_registration
  AFTER INSERT ON public.program_interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_interest_registration();