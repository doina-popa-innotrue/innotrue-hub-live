-- Drop deprecated is_published column from resource_library.
-- Visibility is now controlled entirely by the 'visibility' column
-- ('private', 'enrolled', 'public'), enforced by can_access_resource() RLS function.
-- The is_published boolean was the old model and is no longer read anywhere.

-- First drop the old RLS policy that references is_published (missed in migration 20260204154644)
DROP POLICY IF EXISTS "Authenticated users can view published resources" ON public.resource_library;

-- Now safe to drop the column
ALTER TABLE public.resource_library DROP COLUMN IF EXISTS is_published;
