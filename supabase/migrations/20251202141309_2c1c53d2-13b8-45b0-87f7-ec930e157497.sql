-- Create signup verification requests table
CREATE TABLE public.signup_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  verification_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signup_verification_requests ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access this table (edge functions)
-- No public policies needed as this is handled by edge functions with service role