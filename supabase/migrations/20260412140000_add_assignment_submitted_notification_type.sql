-- Fix: the edge function notify-assignment-submitted calls
-- create_notification('assignment_submitted', ...) but no row with
-- key = 'assignment_submitted' exists in notification_types.
-- The RPC throws RAISE EXCEPTION 'Invalid notification type: ...'
-- and the edge function silently swallows the error, so instructors
-- never receive the notification.
--
-- The email template and preference column already exist (migration
-- 20260116064810).  This migration adds the missing notification_types row.

INSERT INTO public.notification_types
  (key, category_id, name, description, icon, is_critical,
   default_email_enabled, default_in_app_enabled,
   email_template_key, order_index)
VALUES
  ('assignment_submitted',
   (SELECT id FROM public.notification_categories WHERE key = 'assignments'),
   'Assignment Submitted',
   'When a client submits an assignment for review',
   'file-check',
   false,
   true,
   true,
   'assignment_submitted',
   5)
ON CONFLICT (key) DO NOTHING;
