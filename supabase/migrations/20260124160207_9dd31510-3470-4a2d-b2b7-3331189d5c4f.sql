-- Drop ONLY the old signature that conflicts
-- Keep the new unified signature with p_owner_type, p_owner_id, p_amount
DROP FUNCTION IF EXISTS public.consume_credits_fifo(
  p_user_id uuid, 
  p_quantity integer, 
  p_feature_key text, 
  p_notes text, 
  p_action_type text, 
  p_action_reference_id text
);