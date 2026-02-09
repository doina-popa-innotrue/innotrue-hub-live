-- Add instructor/coach assignment notification preferences to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS instructor_program_assignments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS instructor_module_assignments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS coach_program_assignments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS coach_module_assignments boolean DEFAULT true;

-- Update the trigger functions to check notification preferences before sending emails

-- Update program assignment notification trigger
CREATE OR REPLACE FUNCTION public.notify_instructor_coach_program_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  user_name text;
  user_id_var uuid;
  program_name text;
  program_desc text;
  program_slug text;
  notification_type text;
  notifications_enabled boolean;
  preference_column text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Determine notification type and user ID based on table
  IF TG_TABLE_NAME = 'program_instructors' THEN
    notification_type := 'instructor_program_assignment';
    user_id_var := NEW.instructor_id;
    preference_column := 'instructor_program_assignments';
  ELSE -- program_coaches
    notification_type := 'coach_program_assignment';
    user_id_var := NEW.coach_id;
    preference_column := 'coach_program_assignments';
  END IF;
  
  -- Check if user has this notification type enabled
  EXECUTE format('SELECT %I FROM public.notification_preferences WHERE user_id = $1', preference_column)
  INTO notifications_enabled
  USING user_id_var;
  
  -- If preferences don't exist, default to enabled
  IF notifications_enabled IS NULL THEN
    notifications_enabled := true;
  END IF;
  
  -- Skip sending notification if disabled
  IF NOT notifications_enabled THEN
    RETURN NEW;
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id_var;
  
  -- Get user name from profiles
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = user_id_var;
  
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

-- Update module assignment notification trigger
CREATE OR REPLACE FUNCTION public.notify_instructor_coach_module_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
  user_name text;
  user_id_var uuid;
  module_title text;
  module_type_text text;
  program_name text;
  program_slug text;
  notification_type text;
  notifications_enabled boolean;
  preference_column text;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Determine notification type and user ID based on table
  IF TG_TABLE_NAME = 'module_instructors' THEN
    notification_type := 'instructor_module_assignment';
    user_id_var := NEW.instructor_id;
    preference_column := 'instructor_module_assignments';
  ELSE -- module_coaches
    notification_type := 'coach_module_assignment';
    user_id_var := NEW.coach_id;
    preference_column := 'coach_module_assignments';
  END IF;
  
  -- Check if user has this notification type enabled
  EXECUTE format('SELECT %I FROM public.notification_preferences WHERE user_id = $1', preference_column)
  INTO notifications_enabled
  USING user_id_var;
  
  -- If preferences don't exist, default to enabled
  IF notifications_enabled IS NULL THEN
    notifications_enabled := true;
  END IF;
  
  -- Skip sending notification if disabled
  IF NOT notifications_enabled THEN
    RETURN NEW;
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id_var;
  
  -- Get user name from profiles
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = user_id_var;
  
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