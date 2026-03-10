-- Link peer session activities to scenario assignments so presenters
-- can open the scenario and fill in answers to each paragraph/question.

ALTER TABLE public.group_session_activities
  ADD COLUMN scenario_assignment_id UUID REFERENCES public.scenario_assignments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.group_session_activities.scenario_assignment_id IS
  'Auto-created scenario assignment for the presenter when a scenario template is linked';
