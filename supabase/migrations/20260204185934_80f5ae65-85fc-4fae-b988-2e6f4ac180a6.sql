-- Create table to link module client content to scenario templates
CREATE TABLE public.module_client_content_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_client_content_id UUID NOT NULL REFERENCES public.module_client_content(id) ON DELETE CASCADE,
  scenario_template_id UUID NOT NULL REFERENCES public.scenario_templates(id) ON DELETE CASCADE,
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_client_content_id, scenario_template_id)
);

-- Enable RLS
ALTER TABLE public.module_client_content_scenarios ENABLE ROW LEVEL SECURITY;

-- Admins can manage all scenario links
CREATE POLICY "Admins can manage module client content scenarios"
  ON public.module_client_content_scenarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Staff (instructors/coaches) can manage scenarios for clients they have relationship with
CREATE POLICY "Staff can manage scenarios for their clients"
  ON public.module_client_content_scenarios
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.module_client_content mcc
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE mcc.id = module_client_content_scenarios.module_client_content_id
      AND ur.role IN ('instructor', 'coach')
      AND public.staff_has_client_relationship(auth.uid(), mcc.user_id)
    )
  );

-- Clients can view their own scenario assignments
CREATE POLICY "Clients can view their own scenario assignments"
  ON public.module_client_content_scenarios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.module_client_content mcc
      WHERE mcc.id = module_client_content_scenarios.module_client_content_id
      AND mcc.user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX idx_module_client_content_scenarios_content_id 
  ON public.module_client_content_scenarios(module_client_content_id);
CREATE INDEX idx_module_client_content_scenarios_template_id 
  ON public.module_client_content_scenarios(scenario_template_id);