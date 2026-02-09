-- Create AI preferences table for user consent and feature toggles
CREATE TABLE public.ai_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ai_insights_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_recommendations_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_given_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own AI preferences"
ON public.ai_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own AI preferences"
ON public.ai_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own AI preferences"
ON public.ai_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_preferences_updated_at
BEFORE UPDATE ON public.ai_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create AI preferences when a user is created (via profiles trigger)
CREATE OR REPLACE FUNCTION public.create_default_ai_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_ai_preferences
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_default_ai_preferences();