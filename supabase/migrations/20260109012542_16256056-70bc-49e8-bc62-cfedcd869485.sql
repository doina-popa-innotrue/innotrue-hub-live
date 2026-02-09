-- Insert default system setting for AI recommendation provider whitelist
-- This stores a JSON array of allowed external course providers
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'ai_recommendation_providers',
  '["Coursera", "Udemy", "LinkedIn Learning", "edX", "Pluralsight"]',
  'JSON array of allowed external course providers for AI recommendations. Leave empty to allow all.'
)
ON CONFLICT (key) DO NOTHING;