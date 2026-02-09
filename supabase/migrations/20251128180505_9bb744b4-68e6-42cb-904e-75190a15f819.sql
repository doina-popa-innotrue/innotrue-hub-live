-- Create a function to send program assignment notifications
CREATE OR REPLACE FUNCTION public.notify_program_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_name text;
  program_name text;
  program_desc text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.client_user_id;
  
  -- Get user name from profiles
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = NEW.client_user_id;
  
  -- Get program details
  SELECT name, description INTO program_name, program_desc
  FROM public.programs
  WHERE id = NEW.program_id;
  
  -- Call the edge function to send email notification
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'email', user_email,
      'name', COALESCE(user_name, 'User'),
      'type', 'program_assignment',
      'timestamp', NEW.created_at,
      'programName', program_name,
      'programDescription', program_desc
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new enrollments
DROP TRIGGER IF EXISTS on_program_assignment ON public.client_enrollments;
CREATE TRIGGER on_program_assignment
  AFTER INSERT ON public.client_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_program_assignment();