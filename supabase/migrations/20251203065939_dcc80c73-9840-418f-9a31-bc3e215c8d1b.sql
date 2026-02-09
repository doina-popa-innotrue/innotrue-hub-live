-- Create lucid_users table to map Evolve360 users to their Lucid accounts
CREATE TABLE public.lucid_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lucid_email TEXT NOT NULL,
  lucid_url TEXT DEFAULT 'https://lucid.app',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.lucid_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all lucid_users
CREATE POLICY "Admins can manage lucid_users"
ON public.lucid_users
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can view their own lucid mapping
CREATE POLICY "Users can view own lucid mapping"
ON public.lucid_users
FOR SELECT
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_lucid_users_updated_at
BEFORE UPDATE ON public.lucid_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();