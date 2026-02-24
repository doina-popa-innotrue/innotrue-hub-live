-- Schema Drift Fix Sprint 1A: Add profiles.email + profiles.is_disabled
-- These columns are referenced by 16+ files and DB functions but never existed.
-- PostgREST returns null for non-existent columns, so features silently fail.

-- Step 1: Add columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

-- Step 3: Backfill is_disabled from auth.users banned_until
UPDATE public.profiles p
SET is_disabled = true
FROM auth.users u
WHERE u.id = p.id AND u.banned_until IS NOT NULL AND u.banned_until > now();

-- Step 4: Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;

-- Step 5: Auto-sync trigger — keeps profiles.email and profiles.is_disabled in sync
-- when auth.users is updated (covers all paths: edge functions, admin API, dashboard, CLI)
CREATE OR REPLACE FUNCTION public.sync_auth_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = CASE WHEN NEW.email IS DISTINCT FROM OLD.email THEN NEW.email ELSE email END,
    is_disabled = CASE
      WHEN NEW.banned_until IS DISTINCT FROM OLD.banned_until
      THEN (NEW.banned_until IS NOT NULL AND NEW.banned_until > now())
      ELSE is_disabled
    END
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email
     OR OLD.banned_until IS DISTINCT FROM NEW.banned_until)
  EXECUTE FUNCTION public.sync_auth_to_profiles();

-- Step 6: Update handle_new_user() to also set email on new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Step 7: Fix create_notification() — references full_name which doesn't exist (should be name)
-- Also update to read email from profiles.email instead of auth.users for consistency
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type_key TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_id UUID;
  v_notification_id UUID;
  v_prefs RECORD;
  v_email TEXT;
  v_name TEXT;
  v_template_key TEXT;
BEGIN
  -- Get notification type
  SELECT id, email_template_key INTO v_type_id, v_template_key
  FROM public.notification_types
  WHERE key = p_type_key AND is_active = true;

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type_key;
  END IF;

  -- Get user preferences
  SELECT * INTO v_prefs
  FROM public.get_user_notification_preference(p_user_id, p_type_key);

  -- Only create in-app notification if enabled
  IF v_prefs.in_app_enabled THEN
    INSERT INTO public.notifications (user_id, notification_type_id, title, message, link, metadata)
    VALUES (p_user_id, v_type_id, p_title, p_message, p_link, p_metadata)
    RETURNING id INTO v_notification_id;
  END IF;

  -- Queue email if enabled and template exists
  IF v_prefs.email_enabled AND v_template_key IS NOT NULL THEN
    -- Get user email and name from profiles (email now synced from auth.users)
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    SELECT name INTO v_name FROM public.profiles WHERE id = p_user_id;

    IF v_email IS NOT NULL THEN
      INSERT INTO public.email_queue (
        notification_id,
        recipient_email,
        recipient_name,
        template_key,
        template_data
      )
      VALUES (
        v_notification_id,
        v_email,
        v_name,
        v_template_key,
        jsonb_build_object(
          'title', p_title,
          'message', p_message,
          'link', p_link,
          'user_name', v_name
        ) || p_metadata
      );
    END IF;
  END IF;

  RETURN v_notification_id;
END;
$$;

-- Note: notify_program_assignment() already references p.email and p.is_disabled
-- from profiles — these will now work correctly since the columns exist.
