-- Add downloadable flag to resource_library table
ALTER TABLE public.resource_library
ADD COLUMN downloadable boolean NOT NULL DEFAULT true;

-- Add a comment for clarity
COMMENT ON COLUMN public.resource_library.downloadable IS 'Whether users can download this resource. Set to false for proprietary/IP content.';