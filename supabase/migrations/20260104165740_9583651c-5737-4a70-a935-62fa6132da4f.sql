-- Add plan requirement to programs
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
ADD COLUMN IF NOT EXISTS min_plan_tier integer DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN public.programs.plan_id IS 'Optional: specific plan required for access';
COMMENT ON COLUMN public.programs.min_plan_tier IS 'Minimum plan tier level required (0 = no restriction)';

-- Add plan requirement to program_modules (alongside existing tier_required)
ALTER TABLE public.program_modules
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
ADD COLUMN IF NOT EXISTS min_plan_tier integer DEFAULT 0;

COMMENT ON COLUMN public.program_modules.plan_id IS 'Optional: specific plan required for module access';
COMMENT ON COLUMN public.program_modules.min_plan_tier IS 'Minimum plan tier level required (0 = no restriction)';

-- Add payment status to enrollments for payment plan tracking
ALTER TABLE public.client_enrollments
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'upfront' CHECK (payment_type IN ('upfront', 'payment_plan', 'free')),
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid' CHECK (payment_status IN ('paid', 'outstanding', 'overdue'));

COMMENT ON COLUMN public.client_enrollments.payment_type IS 'upfront = paid in full, payment_plan = installments, free = no payment required';
COMMENT ON COLUMN public.client_enrollments.payment_status IS 'paid = current, outstanding = has pending payments, overdue = past due';

-- Add plan-based access to resource library items
ALTER TABLE public.resource_library
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
ADD COLUMN IF NOT EXISTS min_plan_tier integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_consumable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS feature_key text;

COMMENT ON COLUMN public.resource_library.plan_id IS 'Optional: specific plan required for access';
COMMENT ON COLUMN public.resource_library.min_plan_tier IS 'Minimum plan tier level required (0 = no restriction)';
COMMENT ON COLUMN public.resource_library.is_consumable IS 'If true, access is tracked against plan limits';
COMMENT ON COLUMN public.resource_library.feature_key IS 'Links to features table for usage tracking when is_consumable=true';

-- Create table for plan-specific resource limits
CREATE TABLE IF NOT EXISTS public.plan_resource_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  monthly_limit integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, resource_id)
);

-- Enable RLS on new table
ALTER TABLE public.plan_resource_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for plan_resource_limits (admin only for management, read for all authenticated)
CREATE POLICY "Admins can manage plan resource limits"
ON public.plan_resource_limits FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view plan resource limits"
ON public.plan_resource_limits FOR SELECT
TO authenticated
USING (true);

-- Create table for tracking resource consumption
CREATE TABLE IF NOT EXISTS public.resource_usage_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  used_count integer NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id, period_start)
);

-- Enable RLS
ALTER TABLE public.resource_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for resource usage tracking
CREATE POLICY "Users can view own resource usage"
ON public.resource_usage_tracking FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resource usage"
ON public.resource_usage_tracking FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resource usage"
ON public.resource_usage_tracking FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all resource usage"
ON public.resource_usage_tracking FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if user has plan access to a program
CREATE OR REPLACE FUNCTION public.has_program_plan_access(
  p_user_id uuid,
  p_program_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_program_min_tier integer;
  v_program_plan_id uuid;
  v_user_plan_tier integer;
  v_user_plan_id uuid;
  v_enrollment record;
BEGIN
  -- Get program requirements
  SELECT min_plan_tier, plan_id INTO v_program_min_tier, v_program_plan_id
  FROM public.programs WHERE id = p_program_id;
  
  -- If no plan restriction, allow access
  IF v_program_min_tier = 0 AND v_program_plan_id IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check for existing enrollment with upfront payment
  SELECT * INTO v_enrollment
  FROM public.client_enrollments
  WHERE client_user_id = p_user_id 
    AND program_id = p_program_id
    AND status = 'active';
  
  IF FOUND THEN
    -- Upfront paid = always has access
    IF v_enrollment.payment_type = 'upfront' THEN
      RETURN true;
    END IF;
    
    -- Payment plan with outstanding/overdue = no access
    IF v_enrollment.payment_type = 'payment_plan' AND v_enrollment.payment_status != 'paid' THEN
      RETURN false;
    END IF;
    
    -- Payment plan that's current = has access
    IF v_enrollment.payment_type = 'payment_plan' AND v_enrollment.payment_status = 'paid' THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Check user's current plan
  SELECT plan_id INTO v_user_plan_id FROM public.profiles WHERE id = p_user_id;
  
  IF v_user_plan_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT tier_level INTO v_user_plan_tier FROM public.plans WHERE id = v_user_plan_id;
  
  -- Check specific plan requirement
  IF v_program_plan_id IS NOT NULL AND v_user_plan_id != v_program_plan_id THEN
    -- Check if user's plan tier is at least as high
    IF v_user_plan_tier < v_program_min_tier THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check tier requirement
  IF v_program_min_tier > 0 AND v_user_plan_tier < v_program_min_tier THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to increment resource usage
CREATE OR REPLACE FUNCTION public.increment_resource_usage(
  p_user_id uuid,
  p_resource_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_usage integer;
  v_limit integer;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_user_plan_id uuid;
BEGIN
  -- Verify caller matches user_id
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  v_period_start := date_trunc('month', now());
  v_period_end := v_period_start + interval '1 month';
  
  -- Get user's plan
  SELECT plan_id INTO v_user_plan_id FROM public.profiles WHERE id = p_user_id;
  
  -- Get limit for this resource on user's plan
  SELECT monthly_limit INTO v_limit
  FROM public.plan_resource_limits
  WHERE plan_id = v_user_plan_id AND resource_id = p_resource_id;
  
  -- Get current usage
  SELECT used_count INTO v_current_usage
  FROM public.resource_usage_tracking
  WHERE user_id = p_user_id 
    AND resource_id = p_resource_id 
    AND period_start = v_period_start;
  
  v_current_usage := COALESCE(v_current_usage, 0);
  
  -- Check limit if set
  IF v_limit IS NOT NULL AND v_current_usage >= v_limit THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Monthly limit reached',
      'current', v_current_usage,
      'limit', v_limit
    );
  END IF;
  
  -- Insert or update usage
  INSERT INTO public.resource_usage_tracking (user_id, resource_id, used_count, period_start, period_end)
  VALUES (p_user_id, p_resource_id, 1, v_period_start, v_period_end)
  ON CONFLICT (user_id, resource_id, period_start)
  DO UPDATE SET 
    used_count = resource_usage_tracking.used_count + 1,
    updated_at = now()
  RETURNING used_count INTO v_current_usage;
  
  RETURN jsonb_build_object(
    'success', true,
    'current', v_current_usage,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit IS NOT NULL THEN v_limit - v_current_usage ELSE NULL END
  );
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_plan_resource_limits_updated_at
BEFORE UPDATE ON public.plan_resource_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resource_usage_tracking_updated_at
BEFORE UPDATE ON public.resource_usage_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();