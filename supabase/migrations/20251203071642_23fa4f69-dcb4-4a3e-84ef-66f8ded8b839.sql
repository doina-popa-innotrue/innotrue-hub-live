-- Create google_drive_users table for mapping users to their shared Google Drive folders
CREATE TABLE public.google_drive_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  folder_url TEXT NOT NULL,
  folder_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_drive_users ENABLE ROW LEVEL SECURITY;

-- Admins can manage all mappings
CREATE POLICY "Admins can manage google_drive_users"
  ON public.google_drive_users
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own mapping
CREATE POLICY "Users can view own google drive mapping"
  ON public.google_drive_users
  FOR SELECT
  USING (auth.uid() = user_id);