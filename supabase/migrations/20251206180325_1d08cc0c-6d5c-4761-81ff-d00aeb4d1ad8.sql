
-- 1. Add a token_hash column to email_change_requests for storing hashed tokens
-- The verification_token column will be removed after migration
ALTER TABLE public.email_change_requests 
ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- 2. Remove admin access to oauth_tokens - admins should not be able to view user OAuth tokens
-- This is a privacy concern - even admins shouldn't see user's third-party access tokens
DROP POLICY IF EXISTS "Admins can view all OAuth tokens" ON public.oauth_tokens;

-- 3. Create a separate billing_info table with stricter access controls
-- Only owners and admins can access billing data
CREATE TABLE IF NOT EXISTS public.billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT,
  vat TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  country TEXT,
  postal_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on billing_info
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;

-- Strict RLS: only user or admin can access their billing info
CREATE POLICY "Users can view their own billing info"
ON public.billing_info
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own billing info"
ON public.billing_info
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing info"
ON public.billing_info
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all billing info"
ON public.billing_info
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_billing_info_updated_at
BEFORE UPDATE ON public.billing_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing billing data from profiles to billing_info
INSERT INTO public.billing_info (user_id, company, vat, address_line1, address_line2, city, country, postal_code, created_at, updated_at)
SELECT 
  id, 
  billing_company, 
  billing_vat, 
  billing_address_line1, 
  billing_address_line2, 
  billing_city, 
  billing_country, 
  billing_postal_code,
  created_at,
  updated_at
FROM public.profiles
WHERE billing_company IS NOT NULL 
   OR billing_vat IS NOT NULL 
   OR billing_address_line1 IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;