-- Add is_purchasable column to plans table to distinguish admin-only plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT true;

-- Create the Programs plan (tier_level 0 - below Free)
INSERT INTO public.plans (key, name, description, is_active, is_free, tier_level, is_purchasable)
VALUES (
  'programs',
  'Programs',
  'For users who have purchased individual programs. Access to purchased program content without a monthly subscription.',
  true,
  true,
  0,
  false
);

-- Create the Continuation plan without fallback (same tier_level 0 as Programs)
INSERT INTO public.plans (key, name, description, is_active, is_free, tier_level, is_purchasable)
VALUES (
  'continuation',
  'Continuation',
  'Continue accessing your completed programs while deciding on your next steps. Upgrade to Pro for full platform access and new programs.',
  true,
  true,
  0,
  false
);