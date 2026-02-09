-- Add toggle for allowing slug-based access (default false for security)
ALTER TABLE public.auth_contexts
ADD COLUMN allow_slug_access BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.auth_contexts.allow_slug_access IS 'When true, allows external URLs to use the human-readable slug instead of the obfuscated public_code. Default false for security.';