-- Mark 'credits' as a system feature with usage description
UPDATE public.features 
SET 
  is_system = true,
  description = 'View credit balance and purchase top-ups. Used by: Credits page, sidebar navigation, dashboard low-balance alerts, onboarding tours.'
WHERE key = 'credits';