-- Create trigger function to auto-create client_profiles when user is enrolled or assigned a plan
CREATE OR REPLACE FUNCTION public.ensure_client_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if client_profile already exists for this user
  IF NOT EXISTS (SELECT 1 FROM public.client_profiles WHERE user_id = NEW.client_user_id) THEN
    INSERT INTO public.client_profiles (user_id, status)
    VALUES (NEW.client_user_id, 'active');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on client_enrollments to auto-create client_profile when enrolled
CREATE TRIGGER create_client_profile_on_enrollment
AFTER INSERT ON public.client_enrollments
FOR EACH ROW
WHEN (NEW.client_user_id IS NOT NULL)
EXECUTE FUNCTION public.ensure_client_profile();

-- Create trigger function for when a user is assigned a plan
CREATE OR REPLACE FUNCTION public.ensure_client_profile_on_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if plan_id was set (from null to a value)
  IF NEW.plan_id IS NOT NULL AND (OLD.plan_id IS NULL OR OLD.plan_id IS DISTINCT FROM NEW.plan_id) THEN
    -- Check if user has client role
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'client') THEN
      -- Check if client_profile already exists
      IF NOT EXISTS (SELECT 1 FROM public.client_profiles WHERE user_id = NEW.id) THEN
        INSERT INTO public.client_profiles (user_id, status)
        VALUES (NEW.id, 'active');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on profiles to auto-create client_profile when plan is assigned
CREATE TRIGGER create_client_profile_on_plan_assignment
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_client_profile_on_plan();