-- Add Stripe integration columns to plans table
ALTER TABLE public.plans 
ADD COLUMN stripe_product_id text,
ADD COLUMN stripe_price_id text;

-- Add indexes for faster lookups
CREATE INDEX idx_plans_stripe_product_id ON public.plans(stripe_product_id);
CREATE INDEX idx_plans_stripe_price_id ON public.plans(stripe_price_id);