-- Add safety and hierarchy fields to plans table
ALTER TABLE public.plans 
ADD COLUMN is_free boolean NOT NULL DEFAULT false,
ADD COLUMN tier_level integer NOT NULL DEFAULT 1,
ADD COLUMN fallback_plan_id uuid REFERENCES public.plans(id);

-- Add index for fallback lookups
CREATE INDEX idx_plans_fallback_plan_id ON public.plans(fallback_plan_id);
CREATE INDEX idx_plans_tier_level ON public.plans(tier_level);

-- Add constraint: fallback plan must be a free plan (enforced via trigger)
CREATE OR REPLACE FUNCTION public.validate_fallback_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fallback_is_free boolean;
  fallback_tier integer;
BEGIN
  IF NEW.fallback_plan_id IS NOT NULL THEN
    -- Get fallback plan details
    SELECT is_free, tier_level INTO fallback_is_free, fallback_tier
    FROM public.plans WHERE id = NEW.fallback_plan_id;
    
    -- Fallback must be a free plan
    IF NOT fallback_is_free THEN
      RAISE EXCEPTION 'Fallback plan must be a free plan';
    END IF;
    
    -- Fallback must be lower tier
    IF fallback_tier >= NEW.tier_level THEN
      RAISE EXCEPTION 'Fallback plan must be a lower tier than current plan';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_plan_fallback
BEFORE INSERT OR UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.validate_fallback_plan();