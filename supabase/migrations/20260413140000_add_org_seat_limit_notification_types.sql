-- The check-org-seat-limits edge function sends notifications with types
-- 'org_seat_limit_warning' and 'org_seat_limit_reached', but no matching
-- rows exist in notification_types. The email templates already exist
-- (migration 20260119015147). This migration adds the missing type rows
-- so create_notification() won't throw RAISE EXCEPTION.

INSERT INTO public.notification_types
  (key, category_id, name, description, icon, is_critical,
   default_email_enabled, default_in_app_enabled,
   email_template_key, order_index)
VALUES
  ('org_seat_limit_warning',
   (SELECT id FROM public.notification_categories WHERE key = 'credits'),
   'Organisation Seat Limit Warning',
   'When your organisation is approaching its sponsored seat limit',
   'alert-triangle',
   false,
   true,
   true,
   'notification_org_seat_warning',
   10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.notification_types
  (key, category_id, name, description, icon, is_critical,
   default_email_enabled, default_in_app_enabled,
   email_template_key, order_index)
VALUES
  ('org_seat_limit_reached',
   (SELECT id FROM public.notification_categories WHERE key = 'credits'),
   'Organisation Seat Limit Reached',
   'When your organisation has reached its sponsored seat limit',
   'alert-circle',
   true,
   true,
   true,
   'notification_org_seat_reached',
   11)
ON CONFLICT (key) DO NOTHING;
