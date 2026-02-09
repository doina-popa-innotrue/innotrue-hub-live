-- Add scheduling link to modules
ALTER TABLE public.program_modules
ADD COLUMN IF NOT EXISTS calendly_event_url TEXT;

-- Add session notification preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS session_requests BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS session_scheduled BOOLEAN NOT NULL DEFAULT true;

-- Create trigger function to notify instructor on session request
CREATE OR REPLACE FUNCTION public.notify_session_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  instructor_email text;
  instructor_name text;
  instructor_id_var uuid;
  client_name text;
  client_email text;
  module_title text;
  program_name text;
  notifications_enabled boolean;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Only trigger on new session requests
  IF NEW.status = 'requested' AND NEW.requested_by IS NOT NULL THEN
    -- Get client details
    SELECT name INTO client_name FROM public.profiles WHERE id = NEW.requested_by;
    SELECT email INTO client_email FROM auth.users WHERE id = NEW.requested_by;
    
    -- Get module and program details
    SELECT pm.title, p.name INTO module_title, program_name
    FROM public.program_modules pm
    JOIN public.programs p ON p.id = pm.program_id
    WHERE pm.id = NEW.module_id;
    
    -- Find the instructor(s) assigned to this module
    FOR instructor_id_var IN
      SELECT mi.instructor_id FROM public.module_instructors mi WHERE mi.module_id = NEW.module_id
    LOOP
      -- Check notification preferences
      SELECT session_requests INTO notifications_enabled
      FROM public.notification_preferences WHERE user_id = instructor_id_var;
      
      IF notifications_enabled IS NULL OR notifications_enabled = true THEN
        SELECT email INTO instructor_email FROM auth.users WHERE id = instructor_id_var;
        SELECT name INTO instructor_name FROM public.profiles WHERE id = instructor_id_var;
        
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key
          ),
          body := jsonb_build_object(
            'email', instructor_email,
            'name', COALESCE(instructor_name, 'Instructor'),
            'type', 'session_request',
            'timestamp', NEW.created_at,
            'moduleName', module_title,
            'programName', program_name,
            'userName', COALESCE(client_name, 'Client'),
            'userEmail', client_email,
            'entityLink', supabase_url || '/teaching/programs/' || NEW.program_id || '/modules/' || NEW.module_id
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger function to notify client when session is scheduled
CREATE OR REPLACE FUNCTION public.notify_session_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_email text;
  client_name text;
  client_user_id uuid;
  instructor_name text;
  module_title text;
  program_name text;
  scheduling_url text;
  notifications_enabled boolean;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Only trigger when status changes to 'scheduled'
  IF NEW.status = 'scheduled' AND (OLD IS NULL OR OLD.status != 'scheduled') THEN
    -- Get module details including scheduling URL
    SELECT pm.title, p.name, pm.calendly_event_url INTO module_title, program_name, scheduling_url
    FROM public.program_modules pm
    JOIN public.programs p ON p.id = pm.program_id
    WHERE pm.id = NEW.module_id;
    
    -- Get instructor name
    IF NEW.instructor_id IS NOT NULL THEN
      SELECT name INTO instructor_name FROM public.profiles WHERE id = NEW.instructor_id;
    END IF;
    
    -- For individual sessions, notify the enrollment owner
    IF NEW.enrollment_id IS NOT NULL THEN
      SELECT ce.client_user_id INTO client_user_id
      FROM public.client_enrollments ce WHERE ce.id = NEW.enrollment_id;
      
      IF client_user_id IS NOT NULL THEN
        -- Check notification preferences
        SELECT session_scheduled INTO notifications_enabled
        FROM public.notification_preferences WHERE user_id = client_user_id;
        
        IF notifications_enabled IS NULL OR notifications_enabled = true THEN
          SELECT email INTO client_email FROM auth.users WHERE id = client_user_id;
          SELECT name INTO client_name FROM public.profiles WHERE id = client_user_id;
          
          PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
              'email', client_email,
              'name', COALESCE(client_name, 'Client'),
              'type', 'session_scheduled',
              'timestamp', NEW.created_at,
              'moduleName', module_title,
              'programName', program_name,
              'instructorName', COALESCE(instructor_name, 'Instructor'),
              'sessionDate', NEW.session_date,
              'sessionTitle', NEW.title,
              'meetingUrl', NEW.meeting_url,
              'schedulingUrl', scheduling_url,
              'entityLink', supabase_url || '/programs/' || NEW.program_id || '/modules/' || NEW.module_id
            )
          );
        END IF;
      END IF;
    END IF;
    
    -- For group sessions, notify all participants
    IF NEW.session_type = 'group' THEN
      FOR client_user_id IN
        SELECT msp.user_id FROM public.module_session_participants msp WHERE msp.session_id = NEW.id
      LOOP
        SELECT session_scheduled INTO notifications_enabled
        FROM public.notification_preferences WHERE user_id = client_user_id;
        
        IF notifications_enabled IS NULL OR notifications_enabled = true THEN
          SELECT email INTO client_email FROM auth.users WHERE id = client_user_id;
          SELECT name INTO client_name FROM public.profiles WHERE id = client_user_id;
          
          PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
              'email', client_email,
              'name', COALESCE(client_name, 'Client'),
              'type', 'session_scheduled',
              'timestamp', NEW.created_at,
              'moduleName', module_title,
              'programName', program_name,
              'instructorName', COALESCE(instructor_name, 'Instructor'),
              'sessionDate', NEW.session_date,
              'sessionTitle', NEW.title,
              'meetingUrl', NEW.meeting_url,
              'schedulingUrl', scheduling_url,
              'entityLink', supabase_url || '/programs/' || NEW.program_id || '/modules/' || NEW.module_id
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_session_request ON public.module_sessions;
CREATE TRIGGER trigger_notify_session_request
  AFTER INSERT ON public.module_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_request();

DROP TRIGGER IF EXISTS trigger_notify_session_scheduled ON public.module_sessions;
CREATE TRIGGER trigger_notify_session_scheduled
  AFTER INSERT OR UPDATE ON public.module_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_scheduled();

-- Add client_response column for accept/reject
ALTER TABLE public.module_sessions
ADD COLUMN IF NOT EXISTS client_response TEXT CHECK (client_response IN ('accepted', 'rejected', 'pending'));