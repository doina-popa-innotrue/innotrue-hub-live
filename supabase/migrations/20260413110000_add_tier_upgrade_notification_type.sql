-- Notification types for tier upgrade requests
-- Enables future notification delivery when requests are submitted/approved

INSERT INTO public.notification_types
  (key, category_id, name, description, icon, is_critical,
   default_email_enabled, default_in_app_enabled,
   email_template_key, order_index)
VALUES
  ('tier_upgrade_requested',
   (SELECT id FROM public.notification_categories WHERE key = 'programs'),
   'Tier Upgrade Requested',
   'When a client submits a tier upgrade request',
   'arrow-up',
   false,
   true,
   true,
   NULL,
   10),
  ('tier_upgrade_approved',
   (SELECT id FROM public.notification_categories WHERE key = 'programs'),
   'Tier Upgrade Approved',
   'When your tier upgrade request is approved',
   'check-circle',
   false,
   true,
   true,
   NULL,
   11)
ON CONFLICT (key) DO NOTHING;
