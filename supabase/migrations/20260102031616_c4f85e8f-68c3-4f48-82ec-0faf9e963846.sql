-- Add consumption tracking to add_ons table
ALTER TABLE public.add_ons 
ADD COLUMN is_consumable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN initial_quantity INTEGER DEFAULT NULL;

-- Add quantity tracking to user_add_ons table
ALTER TABLE public.user_add_ons
ADD COLUMN quantity_granted INTEGER DEFAULT NULL,
ADD COLUMN quantity_remaining INTEGER DEFAULT NULL,
ADD COLUMN quantity_used INTEGER NOT NULL DEFAULT 0;

-- Create consumption log for audit trail
CREATE TABLE public.add_on_consumption_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_add_on_id UUID NOT NULL REFERENCES public.user_add_ons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quantity_consumed INTEGER NOT NULL DEFAULT 1,
  action_type TEXT NOT NULL,
  action_reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_consumption_log_user_add_on ON public.add_on_consumption_log(user_add_on_id);
CREATE INDEX idx_consumption_log_user ON public.add_on_consumption_log(user_id);
CREATE INDEX idx_consumption_log_action ON public.add_on_consumption_log(action_type);

-- Enable RLS
ALTER TABLE public.add_on_consumption_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for consumption log
CREATE POLICY "Admins can manage all consumption logs"
ON public.add_on_consumption_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own consumption logs"
ON public.add_on_consumption_log
FOR SELECT
USING (auth.uid() = user_id);

-- Function to consume add-on credits
CREATE OR REPLACE FUNCTION public.consume_add_on(
  p_user_id UUID,
  p_add_on_key TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_action_type TEXT DEFAULT 'general',
  p_action_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_add_on RECORD;
  v_add_on RECORD;
BEGIN
  -- Get the add-on
  SELECT * INTO v_add_on FROM add_ons WHERE key = p_add_on_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add-on not found');
  END IF;

  -- Check if add-on is consumable
  IF NOT v_add_on.is_consumable THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add-on is not consumable');
  END IF;

  -- Get user's add-on with remaining quantity
  SELECT ua.* INTO v_user_add_on 
  FROM user_add_ons ua
  WHERE ua.user_id = p_user_id 
    AND ua.add_on_id = v_add_on.id
    AND (ua.expires_at IS NULL OR ua.expires_at > now())
    AND ua.quantity_remaining >= p_quantity
  ORDER BY ua.expires_at NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'remaining', 0);
  END IF;

  -- Deduct credits
  UPDATE user_add_ons
  SET quantity_remaining = quantity_remaining - p_quantity,
      quantity_used = quantity_used + p_quantity
  WHERE id = v_user_add_on.id;

  -- Log consumption
  INSERT INTO add_on_consumption_log (
    user_add_on_id, user_id, quantity_consumed, action_type, action_reference_id, notes
  ) VALUES (
    v_user_add_on.id, p_user_id, p_quantity, p_action_type, p_action_reference_id, p_notes
  );

  RETURN jsonb_build_object(
    'success', true, 
    'consumed', p_quantity, 
    'remaining', v_user_add_on.quantity_remaining - p_quantity
  );
END;
$$;

-- Function to get user's remaining credits for an add-on
CREATE OR REPLACE FUNCTION public.get_add_on_balance(p_user_id UUID, p_add_on_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(ua.quantity_remaining), 0) INTO v_total
  FROM user_add_ons ua
  JOIN add_ons a ON a.id = ua.add_on_id
  WHERE ua.user_id = p_user_id
    AND a.key = p_add_on_key
    AND a.is_consumable = true
    AND (ua.expires_at IS NULL OR ua.expires_at > now());
  
  RETURN v_total;
END;
$$;