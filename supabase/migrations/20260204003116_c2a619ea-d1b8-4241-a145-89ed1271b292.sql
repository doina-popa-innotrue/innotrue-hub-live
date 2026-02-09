-- Add index for module_id on scenario_assignments for better query performance
CREATE INDEX IF NOT EXISTS idx_scenario_assignments_module_id ON public.scenario_assignments(module_id);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_scenario_assignments_user_module ON public.scenario_assignments(user_id, module_id);