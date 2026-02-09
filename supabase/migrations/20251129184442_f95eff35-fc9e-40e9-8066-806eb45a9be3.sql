-- Create trigger function to notify instructors/coaches when assigned to programs
CREATE OR REPLACE FUNCTION public.notify_instructor_coach_program_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  user_name text;
  program_name text;
  program_desc text;
  program_slug text;
  notification_type text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Determine notification type based on table
  IF TG_TABLE_NAME = 'program_instructors' THEN
    notification_type := 'instructor_program_assignment';
    
    -- Get instructor email from auth.users
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.instructor_id;
    
    -- Get instructor name from profiles
    SELECT name INTO user_name
    FROM public.profiles
    WHERE id = NEW.instructor_id;
  ELSE -- program_coaches
    notification_type := 'coach_program_assignment';
    
    -- Get coach email from auth.users
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.coach_id;
    
    -- Get coach name from profiles
    SELECT name INTO user_name
    FROM public.profiles
    WHERE id = NEW.coach_id;
  END IF;
  
  -- Get program details
  SELECT name, description, slug INTO program_name, program_desc, program_slug
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
      'type', notification_type,
      'timestamp', NEW.created_at,
      'programName', program_name,
      'programDescription', program_desc,
      'entityLink', supabase_url || '/admin/programs/' || program_slug
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger function to notify instructors/coaches when assigned to modules
CREATE OR REPLACE FUNCTION public.notify_instructor_coach_module_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  user_name text;
  module_title text;
  module_type_text text;
  program_name text;
  program_slug text;
  notification_type text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Determine notification type based on table
  IF TG_TABLE_NAME = 'module_instructors' THEN
    notification_type := 'instructor_module_assignment';
    
    -- Get instructor email from auth.users
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.instructor_id;
    
    -- Get instructor name from profiles
    SELECT name INTO user_name
    FROM public.profiles
    WHERE id = NEW.instructor_id;
  ELSE -- module_coaches
    notification_type := 'coach_module_assignment';
    
    -- Get coach email from auth.users
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = NEW.coach_id;
    
    -- Get coach name from profiles
    SELECT name INTO user_name
    FROM public.profiles
    WHERE id = NEW.coach_id;
  END IF;
  
  -- Get module details and program info
  SELECT pm.title, pm.module_type::text, p.name, p.slug
  INTO module_title, module_type_text, program_name, program_slug
  FROM public.program_modules pm
  JOIN public.programs p ON p.id = pm.program_id
  WHERE pm.id = NEW.module_id;
  
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
      'type', notification_type,
      'timestamp', NEW.created_at,
      'moduleName', module_title,
      'moduleType', module_type_text,
      'programName', program_name,
      'entityLink', supabase_url || '/admin/programs/' || program_slug
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers for program instructor assignments
DROP TRIGGER IF EXISTS on_program_instructor_assigned ON public.program_instructors;
CREATE TRIGGER on_program_instructor_assigned
  AFTER INSERT ON public.program_instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_instructor_coach_program_assignment();

-- Create triggers for program coach assignments
DROP TRIGGER IF EXISTS on_program_coach_assigned ON public.program_coaches;
CREATE TRIGGER on_program_coach_assigned
  AFTER INSERT ON public.program_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_instructor_coach_program_assignment();

-- Create triggers for module instructor assignments
DROP TRIGGER IF EXISTS on_module_instructor_assigned ON public.module_instructors;
CREATE TRIGGER on_module_instructor_assigned
  AFTER INSERT ON public.module_instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_instructor_coach_module_assignment();

-- Create triggers for module coach assignments
DROP TRIGGER IF EXISTS on_module_coach_assigned ON public.module_coaches;
CREATE TRIGGER on_module_coach_assigned
  AFTER INSERT ON public.module_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_instructor_coach_module_assignment();