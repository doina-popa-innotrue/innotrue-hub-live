-- Drop the permissive read policy and create admin-only read policy
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;

-- Only admins can read system settings
CREATE POLICY "Admins can read system settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));