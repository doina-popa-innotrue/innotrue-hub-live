-- Add ip_address column for rate limiting
ALTER TABLE public.signup_verification_requests 
ADD COLUMN IF NOT EXISTS ip_address text;

-- Create index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_signup_verification_ip_created 
ON public.signup_verification_requests (ip_address, created_at);