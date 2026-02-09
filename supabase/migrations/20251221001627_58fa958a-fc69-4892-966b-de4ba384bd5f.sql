-- Remove the overly permissive SELECT policy that exposes encrypted tokens to clients
DROP POLICY IF EXISTS "Users can view their own OAuth tokens" ON public.oauth_tokens;

-- Remove the ALL policy which also includes SELECT access
DROP POLICY IF EXISTS "Users can only access their own tokens" ON public.oauth_tokens;

-- Add admin-only SELECT policy (tokens should only be accessed server-side via service role)
CREATE POLICY "Only admins can view OAuth tokens"
ON public.oauth_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep the INSERT, UPDATE, DELETE policies for user token management
-- Users can still create/update/delete their tokens, but cannot read them back
-- The actual token usage happens via edge functions with service role access