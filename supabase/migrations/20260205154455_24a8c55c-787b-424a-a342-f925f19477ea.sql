-- Create platform_settings table for storing platform-wide settings like last forced refresh
CREATE TABLE public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_force_refresh TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default row
INSERT INTO public.platform_settings (id) VALUES ('default');

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read platform settings
CREATE POLICY "Authenticated users can view platform settings"
ON public.platform_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can update platform settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);