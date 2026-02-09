-- Create plan_prices table for multiple billing intervals per plan
CREATE TABLE public.plan_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  billing_interval text NOT NULL, -- 'month', 'year', 'week', 'day', 'one_time'
  price_cents integer NOT NULL,
  stripe_price_id text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(plan_id, billing_interval)
);

-- Enable RLS
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

-- Admins can manage plan prices
CREATE POLICY "Admins can manage plan prices"
ON public.plan_prices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view plan prices
CREATE POLICY "Authenticated users can view plan prices"
ON public.plan_prices FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add indexes
CREATE INDEX idx_plan_prices_plan_id ON public.plan_prices(plan_id);
CREATE INDEX idx_plan_prices_stripe_price_id ON public.plan_prices(stripe_price_id);

-- Remove the stripe_price_id column from plans (now in plan_prices)
ALTER TABLE public.plans DROP COLUMN IF EXISTS stripe_price_id;

-- Also remove price_cents and billing_interval from plans (now in plan_prices)
ALTER TABLE public.plans DROP COLUMN IF EXISTS price_cents;
ALTER TABLE public.plans DROP COLUMN IF EXISTS billing_interval;