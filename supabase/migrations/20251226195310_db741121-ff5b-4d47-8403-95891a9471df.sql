-- Create miro_users table
CREATE TABLE public.miro_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  miro_email text NOT NULL,
  miro_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.miro_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for miro_users
CREATE POLICY "Users can view own miro mapping"
ON public.miro_users FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own miro mapping"
ON public.miro_users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own miro mapping"
ON public.miro_users FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own miro mapping"
ON public.miro_users FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage miro_users"
ON public.miro_users FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create mural_users table
CREATE TABLE public.mural_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  mural_email text NOT NULL,
  mural_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mural_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for mural_users
CREATE POLICY "Users can view own mural mapping"
ON public.mural_users FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mural mapping"
ON public.mural_users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mural mapping"
ON public.mural_users FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mural mapping"
ON public.mural_users FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage mural_users"
ON public.mural_users FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));