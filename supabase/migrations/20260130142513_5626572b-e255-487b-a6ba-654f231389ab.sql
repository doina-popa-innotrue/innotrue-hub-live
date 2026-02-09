-- Create table for storing user OAuth tokens (encrypted)
CREATE TABLE public.user_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'zoom', 'google_calendar'
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[],
  provider_user_id TEXT, -- Zoom user ID or Google user ID
  provider_email TEXT, -- Email associated with the provider account
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view their own OAuth tokens"
ON public.user_oauth_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own OAuth tokens"
ON public.user_oauth_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own OAuth tokens"
ON public.user_oauth_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own OAuth tokens"
ON public.user_oauth_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_oauth_tokens_user_provider ON public.user_oauth_tokens(user_id, provider);

-- Add trigger for updated_at
CREATE TRIGGER update_user_oauth_tokens_updated_at
BEFORE UPDATE ON public.user_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();