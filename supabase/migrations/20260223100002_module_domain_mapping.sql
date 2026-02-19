-- DP5: Module ↔ capability assessment domain mapping
-- Completing a module provides evidence for the mapped domain

CREATE TABLE IF NOT EXISTS public.module_domain_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  capability_domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  relevance TEXT NOT NULL DEFAULT 'primary' CHECK (relevance IN ('primary', 'secondary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, capability_domain_id)
);

-- RLS
ALTER TABLE public.module_domain_mappings ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins have full access to module_domain_mappings"
  ON public.module_domain_mappings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Instructors/coaches can read (to show evidence in dev profiles)
CREATE POLICY "Staff can view module_domain_mappings"
  ON public.module_domain_mappings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role) OR
    has_role(auth.uid(), 'coach'::app_role)
  );

-- Clients can read (to see their own evidence)
CREATE POLICY "Clients can view module_domain_mappings"
  ON public.module_domain_mappings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role));

CREATE INDEX idx_module_domain_mappings_module ON public.module_domain_mappings(module_id);
CREATE INDEX idx_module_domain_mappings_domain ON public.module_domain_mappings(capability_domain_id);

COMMENT ON TABLE public.module_domain_mappings IS
  'Links program modules to capability assessment domains. Completing a mapped module provides evidence for that domain.';
