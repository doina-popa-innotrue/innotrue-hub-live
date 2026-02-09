-- Fix the notify_session_scheduled trigger function
-- Issues fixed:
-- 1. Pass scheduledDate (not just sessionDate) so date displays correctly
-- 2. Don't pass schedulingUrl since session is already scheduled (removes "Schedule" button)
-- 3. Use custom domain app.innotrue.com for entityLink
-- 4. Support both instructor_id and coach_id for staff name resolution

CREATE OR REPLACE FUNCTION public.notify_session_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  client_email text;
  client_name text;
  client_user_id uuid;
  staff_name text;
  module_title text;
  program_name text;
  notifications_enabled boolean;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  site_url text := 'https://app.innotrue.com';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Only trigger when status changes to 'scheduled' AND we have an actual session_date
  IF NEW.status = 'scheduled' AND NEW.session_date IS NOT NULL AND (OLD IS NULL OR OLD.status != 'scheduled') THEN
    -- Get module details (no longer fetching scheduling URL - session is already scheduled)
    SELECT pm.title, p.name INTO module_title, program_name
    FROM public.program_modules pm
    JOIN public.programs p ON p.id = pm.program_id
    WHERE pm.id = NEW.module_id;
    
    -- Get staff name (instructor OR coach)
    IF NEW.instructor_id IS NOT NULL THEN
      SELECT name INTO staff_name FROM public.profiles WHERE id = NEW.instructor_id;
    ELSIF NEW.coach_id IS NOT NULL THEN
      SELECT name INTO staff_name FROM public.profiles WHERE id = NEW.coach_id;
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
          
          -- IMPORTANT: Pass both sessionDate AND scheduledDate for proper formatting
          -- Do NOT pass schedulingUrl since session is already scheduled
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
              'instructorName', COALESCE(staff_name, 'Your facilitator'),
              'sessionDate', NEW.session_date,
              'scheduledDate', NEW.session_date,
              'sessionTitle', NEW.title,
              'meetingUrl', NEW.meeting_url,
              'entityLink', site_url || '/programs/' || NEW.program_id || '/modules/' || NEW.module_id
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
              'instructorName', COALESCE(staff_name, 'Your facilitator'),
              'sessionDate', NEW.session_date,
              'scheduledDate', NEW.session_date,
              'sessionTitle', NEW.title,
              'meetingUrl', NEW.meeting_url,
              'entityLink', site_url || '/programs/' || NEW.program_id || '/modules/' || NEW.module_id
            )
          );
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;