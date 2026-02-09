-- Fix remaining public accessibility issues

-- 1. wheel_categories - Make authenticated only
DROP POLICY IF EXISTS "Anyone can view wheel categories" ON public.wheel_categories;
DROP POLICY IF EXISTS "Authenticated users can view wheel categories" ON public.wheel_categories;
CREATE POLICY "Authenticated users can view wheel categories" 
ON public.wheel_categories 
FOR SELECT 
TO authenticated
USING (true);

-- 2. module_skills - Make authenticated only  
DROP POLICY IF EXISTS "Anyone can view module skills" ON public.module_skills;
DROP POLICY IF EXISTS "Authenticated users can view module skills" ON public.module_skills;
CREATE POLICY "Authenticated users can view module skills" 
ON public.module_skills 
FOR SELECT 
TO authenticated
USING (true);