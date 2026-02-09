-- =============================================
-- Security Fix: Restrict public SELECT policies to authenticated users
-- =============================================

-- 1. org_platform_tiers - Pricing strategy exposure
DROP POLICY IF EXISTS "Anyone can view active platform tiers" ON public.org_platform_tiers;
CREATE POLICY "Authenticated users can view active platform tiers" 
ON public.org_platform_tiers 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- 2. plan_credit_allocations - Credit economics exposure
DROP POLICY IF EXISTS "Anyone can read plan credit allocations" ON public.plan_credit_allocations;
CREATE POLICY "Authenticated users can read plan credit allocations" 
ON public.plan_credit_allocations 
FOR SELECT 
TO authenticated
USING (true);

-- 3. program_plan_features - Feature gating exposure (already has authenticated but uses true)
DROP POLICY IF EXISTS "Authenticated users can view program plan features" ON public.program_plan_features;
CREATE POLICY "Authenticated users can view program plan features" 
ON public.program_plan_features 
FOR SELECT 
TO authenticated
USING (true);

-- 4. program_plans - Subscription tiers exposure
DROP POLICY IF EXISTS "Authenticated users can view active program plans" ON public.program_plans;
CREATE POLICY "Authenticated users can view active program plans" 
ON public.program_plans 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- 5. feedback_template_types - Assessment criteria exposure
DROP POLICY IF EXISTS "Authenticated users can view active templates" ON public.feedback_template_types;
CREATE POLICY "Authenticated users can view active templates" 
ON public.feedback_template_types 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- 6. module_assignment_types - Assessment methodology exposure
DROP POLICY IF EXISTS "Everyone can view active assessment types" ON public.module_assignment_types;
CREATE POLICY "Authenticated users can view active assessment types" 
ON public.module_assignment_types 
FOR SELECT 
TO authenticated
USING (is_active = true);