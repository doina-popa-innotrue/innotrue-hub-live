-- Create function to notify admins about Circle connection requests
CREATE OR REPLACE FUNCTION public.notify_circle_interest_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  user_email text;
  admin_email text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Get user details
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
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
        'type', 'circle_connection_request',
        'timestamp', NEW.created_at,
        'userName', COALESCE(user_name, 'User'),
        'userEmail', user_email,
        'entityLink', supabase_url || '/admin/circle'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to send notification on new Circle request
CREATE TRIGGER notify_circle_interest_registration_trigger
AFTER INSERT ON public.circle_interest_registrations
FOR EACH ROW
EXECUTE FUNCTION public.notify_circle_interest_registration();