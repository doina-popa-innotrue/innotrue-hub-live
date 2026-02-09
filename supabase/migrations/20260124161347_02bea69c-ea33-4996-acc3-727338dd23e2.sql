
-- Fix the notify_program_assignment function to NOT access auth.users
-- and use the correct column name (client_user_id instead of client_id)
CREATE OR REPLACE FUNCTION public.notify_program_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  user_disabled BOOLEAN;
  program_name TEXT;
  program_description TEXT;
  supabase_url TEXT;
  anon_key TEXT;
  should_notify BOOLEAN;
BEGIN
  -- Get user info from profiles only (not auth.users)
  -- Email is now stored in profiles table
  SELECT p.name, p.email, p.is_disabled
  INTO user_name, user_email, user_disabled
  FROM public.profiles p
  WHERE p.id = NEW.client_user_id;

  -- Skip notification if user is disabled or not found
  IF user_disabled = true OR user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check notification preferences
  SELECT COALESCE(np.program_assignments, true)
  INTO should_notify
  FROM public.notification_preferences np
  WHERE np.user_id = NEW.client_user_id;

  -- Default to true if no preferences found
  IF should_notify IS NULL THEN
    should_notify := true;
  END IF;

  IF NOT should_notify THEN
    RETURN NEW;
  END IF;

  -- Get program details
  SELECT name, description
  INTO program_name, program_description
  FROM public.programs
  WHERE id = NEW.program_id;

  -- Get Supabase URL and anon key from vault or env
  supabase_url := current_setting('app.settings.supabase_url', true);
  anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Fallback to environment variable pattern if not set
  IF supabase_url IS NULL OR supabase_url = '' THEN
    SELECT decrypted_secret INTO supabase_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;
  END IF;
  
  IF anon_key IS NULL OR anon_key = '' THEN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key'
    LIMIT 1;
  END IF;

  -- Only send if we have the necessary config
  IF supabase_url IS NOT NULL AND anon_key IS NOT NULL AND user_email IS NOT NULL THEN
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
        'programName', COALESCE(program_name, 'Program'),
        'programDescription', COALESCE(program_description, '')
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the enrollment
  RAISE WARNING 'notify_program_assignment failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
