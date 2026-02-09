-- Drop the problematic admin policy and recreate using proper has_role function
DROP POLICY IF EXISTS "Admins can manage credit services" ON public.credit_services;

CREATE POLICY "Admins can manage credit services"
ON public.credit_services
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));