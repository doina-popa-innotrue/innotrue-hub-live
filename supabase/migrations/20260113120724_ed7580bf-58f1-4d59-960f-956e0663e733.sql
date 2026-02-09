-- Add capability_assessment_id to program_modules for self-assessment type modules
ALTER TABLE public.program_modules 
ADD COLUMN capability_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE SET NULL;

-- Add scoring_assessment_id to module_assignment_types for instructor scoring
ALTER TABLE public.module_assignment_types 
ADD COLUMN scoring_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE SET NULL;

-- Add scoring fields to module_assignments for instructor grading
ALTER TABLE public.module_assignments 
ADD COLUMN scoring_snapshot_id UUID REFERENCES public.capability_snapshots(id) ON DELETE SET NULL,
ADD COLUMN scored_by UUID,
ADD COLUMN scored_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN instructor_notes TEXT;

-- Create index for faster lookups
CREATE INDEX idx_program_modules_capability_assessment ON public.program_modules(capability_assessment_id);
CREATE INDEX idx_module_assignment_types_scoring ON public.module_assignment_types(scoring_assessment_id);
CREATE INDEX idx_module_assignments_scoring ON public.module_assignments(scoring_snapshot_id);