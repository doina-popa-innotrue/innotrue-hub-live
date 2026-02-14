-- Drop deprecated is_published column from resource_library.
-- Visibility is now controlled entirely by the 'visibility' column
-- ('private', 'enrolled', 'public'), enforced by can_access_resource() RLS function.
-- The is_published boolean was the old model and is no longer read anywhere.

ALTER TABLE public.resource_library DROP COLUMN IF EXISTS is_published;
