
-- Fix security warnings: Change public SELECT policies to require authentication
-- These tables contain business/pricing data that should only be visible to authenticated users

-- 1. assessment_categories: require auth for viewing
DROP POLICY IF EXISTS "Anyone can view active assessment categories" ON public.assessment_categories;
CREATE POLICY "Authenticated users can view active assessment categories"
  ON public.assessment_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. org_credit_packages: require auth for viewing pricing
DROP POLICY IF EXISTS "Anyone can view active credit packages" ON public.org_credit_packages;
CREATE POLICY "Authenticated users can view active credit packages"
  ON public.org_credit_packages
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 3. credit_services: require auth for viewing pricing
DROP POLICY IF EXISTS "Anyone can view active credit services" ON public.credit_services;
CREATE POLICY "Authenticated users can view active credit services"
  ON public.credit_services
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 4. credit_topup_packages: require auth for viewing pricing
DROP POLICY IF EXISTS "Anyone can view active topup packages" ON public.credit_topup_packages;
CREATE POLICY "Authenticated users can view active topup packages"
  ON public.credit_topup_packages
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 5. skills: require auth for viewing taxonomy
DROP POLICY IF EXISTS "Anyone can view skills" ON public.skills;
CREATE POLICY "Authenticated users can view skills"
  ON public.skills
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. status_markers: require auth for viewing
DROP POLICY IF EXISTS "Everyone can view active status markers" ON public.status_markers;
CREATE POLICY "Authenticated users can view active status markers"
  ON public.status_markers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 7. psychometric_assessments: require auth (public assessments handled via edge function/public pages)
DROP POLICY IF EXISTS "Everyone can view active assessments" ON public.psychometric_assessments;
CREATE POLICY "Authenticated users can view active assessments"
  ON public.psychometric_assessments
  FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
