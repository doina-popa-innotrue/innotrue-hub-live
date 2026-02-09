-- Create table for decision capability to feature mappings
CREATE TABLE public.decision_capability_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capability TEXT NOT NULL UNIQUE,
  feature_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decision_capability_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage capability settings
CREATE POLICY "Admins can manage capability settings"
ON public.decision_capability_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view capability settings
CREATE POLICY "Authenticated users can view capability settings"
ON public.decision_capability_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default values
INSERT INTO public.decision_capability_settings (capability, feature_key) VALUES
  ('core_decisions', 'decision_toolkit_basic'),
  ('options_pros_cons', 'decision_toolkit_basic'),
  ('basic_reflections', 'decision_toolkit_basic'),
  ('task_management', 'decision_toolkit_basic'),
  ('advanced_frameworks', 'decision_toolkit_advanced'),
  ('values_alignment', 'decision_toolkit_advanced'),
  ('analytics_dashboard', 'decision_toolkit_advanced'),
  ('reminders_followups', 'decision_toolkit_advanced'),
  ('outcome_tracking', 'decision_toolkit_advanced'),
  ('decision_templates', 'decision_toolkit_advanced'),
  ('decision_journaling', 'decision_toolkit_advanced'),
  ('coach_sharing', 'decision_toolkit_advanced');

-- Create trigger for updated_at
CREATE TRIGGER update_decision_capability_settings_updated_at
BEFORE UPDATE ON public.decision_capability_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();