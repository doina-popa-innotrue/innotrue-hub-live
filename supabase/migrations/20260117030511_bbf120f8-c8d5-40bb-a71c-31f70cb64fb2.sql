-- Fix the documentation view to not use SECURITY DEFINER
-- Drop and recreate as a simple static view with SECURITY INVOKER
DROP VIEW IF EXISTS public.credit_system_documentation;

-- Recreate with explicit SECURITY INVOKER (the default, but being explicit)
CREATE VIEW public.credit_system_documentation 
WITH (security_invoker = true)
AS
SELECT 
  'Credit System Architecture'::text as title,
  'The unified credit system uses lazy calculation with FIFO consumption'::text as description,
  jsonb_build_object(
    'primary_functions', jsonb_build_array(
      'get_user_credit_summary_v2 - Get user credit breakdown (plan + program + bonus)',
      'get_org_credit_summary_v2 - Get org credit breakdown (plan + bonus)',
      'consume_credits_fifo - Consume credits in priority order (Plan → Program → Bonus)',
      'grant_credit_batch - Add bonus/purchased credits as a batch',
      'get_billing_period - Calculate current billing period based on subscription start'
    ),
    'deprecated_functions', jsonb_build_array(
      'get_user_credit_summary (use v2)',
      'consume_user_credits (use consume_credits_fifo)',
      'add_user_credits (use grant_credit_batch)',
      'get_add_on_balance (use get_user_credit_summary_v2)',
      'consume_add_on (use consume_credits_fifo)',
      'get_unified_credits (use get_user_credit_summary_v2)',
      'consume_unified_credits (use consume_credits_fifo)'
    ),
    'consumption_priority', jsonb_build_array(
      '1. Plan allowance (lazy calculated: allowance - period_usage)',
      '2. Program entitlements (from active enrollments, FIFO by enrollment date)',
      '3. Bonus batches (from credit_batches table, FIFO by expiration date)'
    ),
    'key_tables', jsonb_build_array(
      'credit_batches - Stores bonus/purchased credits with expiration',
      'credit_usage_periods - Tracks usage per billing period',
      'user_program_entitlement_usage - Tracks program entitlement consumption'
    )
  ) as architecture;

-- Grant read access (this is just documentation)
GRANT SELECT ON public.credit_system_documentation TO authenticated;