-- Update notify_program_assignment to check is_disabled before sending notification
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
  -- Get user info including disabled status
  SELECT p.name, au.email, p.is_disabled
  INTO user_name, user_email, user_disabled
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.client_id;

  -- Skip notification if user is disabled
  IF user_disabled = true THEN
    RETURN NEW;
  END IF;

  -- Check notification preferences
  SELECT COALESCE(np.program_assignments, true)
  INTO should_notify
  FROM public.notification_preferences np
  WHERE np.user_id = NEW.client_id;

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
END;
$$;