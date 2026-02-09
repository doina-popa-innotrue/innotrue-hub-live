-- Create usage tracking table for metered features
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, feature_key, period_start)
);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage"
  ON public.usage_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON public.usage_tracking
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert usage"
  ON public.usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update usage"
  ON public.usage_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_usage_tracking_updated_at
  BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
  _user_id UUID,
  _feature_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage INTEGER;
  current_period_start TIMESTAMP WITH TIME ZONE;
  current_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  current_period_start := date_trunc('month', now());
  current_period_end := current_period_start + interval '1 month';
  
  -- Insert or update usage
  INSERT INTO public.usage_tracking (user_id, feature_key, used_count, period_start, period_end)
  VALUES (_user_id, _feature_key, 1, current_period_start, current_period_end)
  ON CONFLICT (user_id, feature_key, period_start)
  DO UPDATE SET 
    used_count = usage_tracking.used_count + 1,
    updated_at = now()
  RETURNING used_count INTO current_usage;
  
  RETURN current_usage;
END;
$$;

-- Function to get current usage
CREATE OR REPLACE FUNCTION public.get_current_usage(
  _user_id UUID,
  _feature_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage INTEGER;
  current_period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  current_period_start := date_trunc('month', now());
  
  SELECT used_count INTO current_usage
  FROM public.usage_tracking
  WHERE user_id = _user_id 
    AND feature_key = _feature_key 
    AND period_start = current_period_start;
  
  RETURN COALESCE(current_usage, 0);
END;
$$;