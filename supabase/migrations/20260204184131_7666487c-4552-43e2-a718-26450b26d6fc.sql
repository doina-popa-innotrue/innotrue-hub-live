
-- Fix overly permissive INSERT policy on credit_consumption_log
-- The consume_credits_fifo function is SECURITY DEFINER and handles all inserts
-- Direct user inserts should be restricted to their own user_id

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert credit consumption logs" ON public.credit_consumption_log;

-- Create a more restrictive policy that only allows users to insert their own consumption logs
-- This still allows the SECURITY DEFINER function to work, but prevents direct manipulation
CREATE POLICY "Users can insert their own credit consumption logs"
  ON public.credit_consumption_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also add an admin policy for administrative purposes
CREATE POLICY "Admins can insert credit consumption logs"
  ON public.credit_consumption_log
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
