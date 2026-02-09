-- Add feature_key column to program_modules
ALTER TABLE public.program_modules
ADD COLUMN feature_key text REFERENCES public.features(key);

-- Create function to consume feature on module completion
CREATE OR REPLACE FUNCTION public.consume_feature_on_module_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_feature_key text;
  v_user_id uuid;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Get the feature_key from the module
    SELECT feature_key INTO v_feature_key
    FROM public.program_modules
    WHERE id = NEW.module_id;
    
    -- Get the user_id from the enrollment
    SELECT client_user_id INTO v_user_id
    FROM public.client_enrollments
    WHERE id = NEW.enrollment_id;
    
    -- If module has a feature_key, increment usage
    IF v_feature_key IS NOT NULL AND v_user_id IS NOT NULL THEN
      PERFORM public.increment_usage(v_user_id, v_feature_key);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on module_progress
CREATE TRIGGER consume_feature_on_module_completion
AFTER INSERT OR UPDATE ON public.module_progress
FOR EACH ROW
EXECUTE FUNCTION public.consume_feature_on_module_completion();