-- Create junction table to link scenarios to modules
CREATE TABLE public.module_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.scenario_templates(id) ON DELETE CASCADE,
  is_required_for_certification BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(module_id, template_id)
);

-- Add module context to scenario assignments (enrollment_id already exists)
ALTER TABLE public.scenario_assignments 
  ADD COLUMN module_id UUID REFERENCES public.program_modules(id) ON DELETE SET NULL;

-- Create indexes for efficient lookups
CREATE INDEX idx_module_scenarios_module_id ON public.module_scenarios(module_id);
CREATE INDEX idx_module_scenarios_template_id ON public.module_scenarios(template_id);
CREATE INDEX idx_scenario_assignments_module_id ON public.scenario_assignments(module_id);

-- Enable RLS on module_scenarios
ALTER TABLE public.module_scenarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies for module_scenarios
-- Admins can manage all
CREATE POLICY "Admins can manage all module scenarios"
ON public.module_scenarios
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view module scenarios for programs they teach
CREATE POLICY "Instructors can view module scenarios"
ON public.module_scenarios
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role)
  AND EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE pm.id = module_scenarios.module_id
    AND pi.instructor_id = auth.uid()
  )
);

-- Coaches can view module scenarios for programs they coach
CREATE POLICY "Coaches can view module scenarios"
ON public.module_scenarios
FOR SELECT
USING (
  has_role(auth.uid(), 'coach'::app_role)
  AND EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE pm.id = module_scenarios.module_id
    AND pc.coach_id = auth.uid()
  )
);

-- Clients can view module scenarios for their enrolled programs
CREATE POLICY "Clients can view module scenarios for enrolled programs"
ON public.module_scenarios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN client_enrollments ce ON ce.program_id = pm.program_id
    WHERE pm.id = module_scenarios.module_id
    AND ce.client_user_id = auth.uid()
    AND ce.status IN ('active', 'completed')
  )
);