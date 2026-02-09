-- Insert new feature records for gating
INSERT INTO public.features (key, name, description)
VALUES 
  ('external_courses', 'External Courses', 'Track courses from other platforms'),
  ('services', 'Services', 'Browse available services and credit costs'),
  ('credits', 'Credits', 'View credit balance and purchase top-ups'),
  ('usage', 'Usage Overview', 'Track AI credits and feature consumption'),
  ('skills_map', 'Skills Map', 'Track acquired skills and share on profile'),
  ('guided_paths', 'Guided Paths', 'Follow curated paths with goals and milestones')
ON CONFLICT (key) DO NOTHING;