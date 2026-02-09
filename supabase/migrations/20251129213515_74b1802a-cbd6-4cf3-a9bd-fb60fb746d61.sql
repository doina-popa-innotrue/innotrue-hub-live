-- Create circle_users table for mapping Evolve360 users to Circle users
CREATE TABLE public.circle_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  circle_user_id TEXT NOT NULL,
  circle_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.circle_users ENABLE ROW LEVEL SECURITY;

-- Admins can manage all Circle mappings
CREATE POLICY "Admins can manage all Circle mappings"
ON public.circle_users
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own Circle mapping
CREATE POLICY "Users can view their own Circle mapping"
ON public.circle_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own Circle mapping
CREATE POLICY "Users can insert their own Circle mapping"
ON public.circle_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own Circle mapping
CREATE POLICY "Users can update their own Circle mapping"
ON public.circle_users
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_circle_users_updated_at
BEFORE UPDATE ON public.circle_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();