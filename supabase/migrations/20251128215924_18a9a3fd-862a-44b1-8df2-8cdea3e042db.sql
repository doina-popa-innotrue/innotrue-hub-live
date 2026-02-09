-- Add links field to program_modules to store multiple resource links
ALTER TABLE public.program_modules
ADD COLUMN links jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.program_modules.links IS 'Array of link objects with structure: [{"name": "Book Session", "url": "https://...", "type": "zoom|talentlms|lucidchart|miro|gdrive|other"}]';

-- Create OAuth tokens table for SSO integrations
CREATE TABLE public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'google', 'miro', 'lucidchart', 'talentlms'
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS on oauth_tokens
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view their own OAuth tokens"
ON public.oauth_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own OAuth tokens"
ON public.oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own OAuth tokens"
ON public.oauth_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own OAuth tokens"
ON public.oauth_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all tokens
CREATE POLICY "Admins can view all OAuth tokens"
ON public.oauth_tokens
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_oauth_tokens_updated_at
BEFORE UPDATE ON public.oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();