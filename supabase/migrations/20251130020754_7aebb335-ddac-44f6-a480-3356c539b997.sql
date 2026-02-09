-- Update enrollment_timeframe constraint to allow 'scheduled'
ALTER TABLE public.program_interest_registrations 
DROP CONSTRAINT IF EXISTS program_interest_registrations_enrollment_timeframe_check;

ALTER TABLE public.program_interest_registrations 
ADD CONSTRAINT program_interest_registrations_enrollment_timeframe_check 
CHECK (enrollment_timeframe IN ('asap', '1-3_months', 'scheduled'));

-- Update notify_interest_registration function to handle scheduled dates
CREATE OR REPLACE FUNCTION public.notify_interest_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  program_name text;
  program_scheduled_dates jsonb;
  user_name text;
  user_email text;
  admin_email text;
  timeframe_text text;
  selected_schedule jsonb;
  schedule_date_formatted text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Get program name and scheduled dates
  SELECT name, scheduled_dates INTO program_name, program_scheduled_dates
  FROM public.programs
  WHERE id = NEW.program_id;
  
  -- Get user details
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  -- Format timeframe based on type
  IF NEW.enrollment_timeframe = 'scheduled' AND NEW.scheduled_date_id IS NOT NULL THEN
    -- Find the selected schedule from scheduled_dates array
    SELECT elem INTO selected_schedule
    FROM jsonb_array_elements(program_scheduled_dates) AS elem
    WHERE elem->>'id' = NEW.scheduled_date_id;
    
    IF selected_schedule IS NOT NULL THEN
      schedule_date_formatted := to_char(
        to_date(selected_schedule->>'date', 'YYYY-MM-DD'),
        'FMDay, FMMonth DD, YYYY'
      );
      timeframe_text := COALESCE(selected_schedule->>'title', 'Scheduled Class') || 
                       ' - ' || schedule_date_formatted;
    ELSE
      timeframe_text := 'Scheduled (date not found)';
    END IF;
  ELSE
    timeframe_text := CASE NEW.enrollment_timeframe
      WHEN 'asap' THEN 'As Soon As Possible'
      WHEN '1-3_months' THEN '1-3 Months'
      ELSE NEW.enrollment_timeframe
    END;
  END IF;
  
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