-- Restrict notification_types to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active notification types" ON public.notification_types;
CREATE POLICY "Authenticated users can view notification types" 
ON public.notification_types FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Restrict notification_categories to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active notification categories" ON public.notification_categories;
CREATE POLICY "Authenticated users can view notification categories" 
ON public.notification_categories FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);