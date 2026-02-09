
-- Fix check constraint to include 'library' as a valid resource_type
ALTER TABLE public.development_items
DROP CONSTRAINT development_items_resource_type_check;

ALTER TABLE public.development_items
ADD CONSTRAINT development_items_resource_type_check
CHECK (resource_type IN ('link', 'file', 'image', 'library') OR resource_type IS NULL);
