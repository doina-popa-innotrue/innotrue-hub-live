-- Fix skill_categories public exposure by restricting to authenticated users only

DROP POLICY IF EXISTS "Anyone can view skill categories" ON public.skill_categories;

CREATE POLICY "Authenticated users can view skill categories"
ON public.skill_categories
FOR SELECT
USING (auth.uid() IS NOT NULL);