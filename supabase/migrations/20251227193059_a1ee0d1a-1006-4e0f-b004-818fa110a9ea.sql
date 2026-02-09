-- Rename training-related assessment tables to assignment tables
-- This differentiates them from psychometric assessments used in coaching

-- Rename module_assessment_types to module_assignment_types
ALTER TABLE public.module_assessment_types RENAME TO module_assignment_types;

-- Rename module_assessment_assignments to module_assignment_configs
ALTER TABLE public.module_assessment_assignments RENAME TO module_assignment_configs;

-- Rename module_assessments to module_assignments
ALTER TABLE public.module_assessments RENAME TO module_assignments;

-- Rename module_assessment_attachments to module_assignment_attachments
ALTER TABLE public.module_assessment_attachments RENAME TO module_assignment_attachments;

-- Update foreign key column names for clarity
ALTER TABLE public.module_assignment_configs 
  RENAME COLUMN assessment_type_id TO assignment_type_id;

ALTER TABLE public.module_assignments
  RENAME COLUMN assessment_type_id TO assignment_type_id;

ALTER TABLE public.module_assignment_attachments
  RENAME COLUMN assessment_id TO assignment_id;

-- Rename storage bucket for consistency
UPDATE storage.buckets 
SET id = 'module-assignment-attachments', name = 'module-assignment-attachments'
WHERE id = 'module-assessment-attachments';