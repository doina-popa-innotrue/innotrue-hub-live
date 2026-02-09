-- Create system_settings table for configurable values
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read system settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update system settings"
ON public.system_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can insert settings
CREATE POLICY "Admins can insert system settings"
ON public.system_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can delete settings
CREATE POLICY "Admins can delete system settings"
ON public.system_settings
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default support email
INSERT INTO public.system_settings (key, value, description)
VALUES ('support_email', 'hubadmin@innotrue.com', 'Email address for user support requests');