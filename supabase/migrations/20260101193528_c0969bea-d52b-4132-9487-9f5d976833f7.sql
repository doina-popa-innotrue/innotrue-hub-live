-- Add status_marker column to client_profiles
ALTER TABLE public.client_profiles 
ADD COLUMN status_marker text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.client_profiles.status_marker IS 'User status marker: CTA candidate, Architect, Alumni, Elite, etc.';