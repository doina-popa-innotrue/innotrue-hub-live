-- Add system setting for ActiveCampaign sync admin user
INSERT INTO system_settings (key, value, description)
VALUES (
  'activecampaign_sync_admin_user_id',
  '',
  'The user ID of the admin who will be used for ActiveCampaign sync operations. Leave empty to use the admin who created each sync config.'
)
ON CONFLICT (key) DO NOTHING;