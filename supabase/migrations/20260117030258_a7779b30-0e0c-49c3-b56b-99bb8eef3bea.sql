-- =====================================================
-- CREDIT SYSTEM CONSOLIDATION
-- Mark legacy functions as deprecated via comments
-- New system uses: get_user_credit_summary_v2, consume_credits_fifo, grant_credit_batch
-- =====================================================

-- Add comments to mark functions as deprecated (using correct signatures)
COMMENT ON FUNCTION public.get_user_credit_summary(p_user_id uuid) IS 
  '@deprecated Use get_user_credit_summary_v2 instead. This function uses the old balance-based system.';

COMMENT ON FUNCTION public.consume_user_credits(p_user_id uuid, p_credit_amount integer, p_action_type text, p_action_reference_id text, p_description text, p_enrollment_id uuid) IS 
  '@deprecated Use consume_credits_fifo instead. This function uses the old balance-based system.';

COMMENT ON FUNCTION public.add_user_credits(p_user_id uuid, p_credit_amount integer, p_transaction_type text, p_description text, p_plan_id uuid, p_add_on_id uuid) IS 
  '@deprecated Use grant_credit_batch instead. Credits should be added as batches for proper FIFO consumption.';

COMMENT ON FUNCTION public.get_add_on_balance(p_user_id uuid, p_add_on_key text) IS 
  '@deprecated Add-ons are now stored in credit_batches. Use get_user_credit_summary_v2 to get bonus credits.';

COMMENT ON FUNCTION public.consume_add_on(p_user_id uuid, p_add_on_key text, p_quantity integer, p_action_type text, p_action_reference_id uuid, p_notes text) IS 
  '@deprecated Use consume_credits_fifo with feature_key parameter instead.';

COMMENT ON FUNCTION public.get_org_credit_summary(p_organization_id uuid) IS 
  '@deprecated Use get_org_credit_summary_v2 instead. This function uses the old balance-based system.';

COMMENT ON FUNCTION public.add_org_credits(p_organization_id uuid, p_credit_amount integer, p_purchase_id uuid, p_description text, p_performed_by uuid) IS 
  '@deprecated Use grant_credit_batch with owner_type=org instead.';

COMMENT ON FUNCTION public.get_unified_credits(p_user_id uuid, p_feature_key text) IS 
  '@deprecated Use get_user_credit_summary_v2 instead. This function has been superseded by the batch system.';

-- Create a view to document the credit system architecture
CREATE OR REPLACE VIEW public.credit_system_documentation AS
SELECT 
  'Credit System Architecture' as title,
  'The unified credit system uses lazy calculation with FIFO consumption' as description,
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