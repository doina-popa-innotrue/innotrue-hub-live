-- =============================================================================
-- Migration: Global email mute toggle + fix create_notification disabled check
-- =============================================================================
-- 1. Add system_settings key for global email mute (admin kill switch)
-- 2. Update create_notification() to skip disabled/inactive users
-- =============================================================================

-- 1. Add global email mute setting
INSERT INTO system_settings (key, value, description)
VALUES ('global_email_mute', 'false',
        'When "true", ALL outbound emails are suppressed platform-wide. '
        'Useful during maintenance, testing, or migrations. '
        'Admin-targeted notifications are also muted. '
        'In-app notifications are still created.')
ON CONFLICT (key) DO NOTHING;

-- 2. Update create_notification to check if user is disabled/inactive
--    This closes the gap where cron jobs (e.g. credit-expiry-notifications)
--    could create notifications and queue emails for disabled users.
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
  v_is_disabled BOOLEAN;
  v_client_status TEXT;
BEGIN
  -- Check if user is disabled or inactive — skip entirely if so
  SELECT p.is_disabled, cp.status
  INTO v_is_disabled, v_client_status
  FROM public.profiles p
  LEFT JOIN public.client_profiles cp ON cp.user_id = p.id
  WHERE p.id = p_user_id;

  IF v_is_disabled = true THEN
    RAISE LOG 'create_notification: skipping disabled user %', p_user_id;
    RETURN NULL;
  END IF;

  IF v_client_status = 'inactive' THEN
    RAISE LOG 'create_notification: skipping inactive user %', p_user_id;
    RETURN NULL;
  END IF;

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
