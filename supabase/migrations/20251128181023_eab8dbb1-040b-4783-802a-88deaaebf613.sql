-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_updates boolean DEFAULT true,
  password_changes boolean DEFAULT true,
  email_changes boolean DEFAULT true,
  program_assignments boolean DEFAULT true,
  program_completions boolean DEFAULT true,
  module_completions boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create default preferences when a new user signs up
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create default preferences
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();

-- Update the notify_program_assignment function to check preferences
CREATE OR REPLACE FUNCTION public.notify_program_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_name text;
  program_name text;
  program_desc text;
  notifications_enabled boolean;
  supabase_url text := 'https://pfwlsxovvqdiwaztqxrj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmd2xzeG92dnFkaXdhenRxeHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyODMzODksImV4cCI6MjA3OTg1OTM4OX0.87H-mA5nEenv5SFn-WfEYZ4Wgz84uBpbciPLeHUinW4';
BEGIN
  -- Check if user has program assignment notifications enabled
  SELECT program_assignments INTO notifications_enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.client_user_id;
  
  -- If preferences don't exist or notifications are disabled, skip sending email
  IF notifications_enabled IS NULL THEN
    notifications_enabled := true; -- Default to enabled if no preferences set
  END IF;
  
  IF NOT notifications_enabled THEN
    RETURN NEW; -- Skip sending notification
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.client_user_id;
  
  -- Get user name from profiles
  SELECT name INTO user_name
  FROM public.profiles
  WHERE id = NEW.client_user_id;
  
  -- Get program details
  SELECT name, description INTO program_name, program_desc
  FROM public.programs
  WHERE id = NEW.program_id;
  
  -- Call the edge function to send email notification
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'email', user_email,
      'name', COALESCE(user_name, 'User'),
      'type', 'program_assignment',
      'timestamp', NEW.created_at,
      'programName', program_name,
      'programDescription', program_desc
    )
  );
  
  RETURN NEW;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();