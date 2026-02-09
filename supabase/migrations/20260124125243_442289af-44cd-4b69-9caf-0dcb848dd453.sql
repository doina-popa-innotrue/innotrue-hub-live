-- Create the credit_consumption_log table for tracking credit usage
CREATE TABLE IF NOT EXISTS public.credit_consumption_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  batch_id uuid,
  quantity integer NOT NULL DEFAULT 1,
  source_type text NOT NULL, -- 'plan', 'program', 'bonus', 'addon'
  feature_key text,
  description text,
  action_type text,
  action_reference_id text,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_consumption_log_user_id ON public.credit_consumption_log(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_consumption_log_consumed_at ON public.credit_consumption_log(consumed_at);
CREATE INDEX IF NOT EXISTS idx_credit_consumption_log_user_period ON public.credit_consumption_log(user_id, consumed_at);
CREATE INDEX IF NOT EXISTS idx_credit_consumption_log_feature ON public.credit_consumption_log(user_id, feature_key, consumed_at);

-- Enable RLS
ALTER TABLE public.credit_consumption_log ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can view their own consumption logs
CREATE POLICY "Users can view their own credit consumption logs"
  ON public.credit_consumption_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policy: Admins can view all consumption logs (using user_roles table)
CREATE POLICY "Admins can view all credit consumption logs"
  ON public.credit_consumption_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- RLS policy: System can insert consumption logs (via security definer functions)
CREATE POLICY "System can insert credit consumption logs"
  ON public.credit_consumption_log
  FOR INSERT
  WITH CHECK (true);