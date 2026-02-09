-- Create table for mapping Evolve360 Hub users to TalentLMS accounts
CREATE TABLE public.talentlms_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talentlms_user_id text NOT NULL,
  talentlms_username text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.talentlms_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own TalentLMS mapping
CREATE POLICY "Users can view their own TalentLMS mapping"
ON public.talentlms_users
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own TalentLMS mapping
CREATE POLICY "Users can insert their own TalentLMS mapping"
ON public.talentlms_users
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own TalentLMS mapping
CREATE POLICY "Users can update their own TalentLMS mapping"
ON public.talentlms_users
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can manage all TalentLMS mappings
CREATE POLICY "Admins can manage all TalentLMS mappings"
ON public.talentlms_users
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_talentlms_users_updated_at
BEFORE UPDATE ON public.talentlms_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();