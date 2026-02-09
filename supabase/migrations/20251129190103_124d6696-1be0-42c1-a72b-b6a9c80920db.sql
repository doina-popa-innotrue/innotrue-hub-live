-- Create instructor module notes table
CREATE TABLE public.instructor_module_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_progress_id UUID NOT NULL REFERENCES public.module_progress(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instructor_module_notes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all notes
CREATE POLICY "Admins can manage all instructor notes"
ON public.instructor_module_notes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view their own notes
CREATE POLICY "Instructors can view their own notes"
ON public.instructor_module_notes
FOR SELECT
TO authenticated
USING (
  auth.uid() = instructor_id 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Instructors can insert their own notes
CREATE POLICY "Instructors can insert their own notes"
ON public.instructor_module_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = instructor_id);

-- Instructors can update their own notes
CREATE POLICY "Instructors can update their own notes"
ON public.instructor_module_notes
FOR UPDATE
TO authenticated
USING (auth.uid() = instructor_id)
WITH CHECK (auth.uid() = instructor_id);

-- Instructors can delete their own notes
CREATE POLICY "Instructors can delete their own notes"
ON public.instructor_module_notes
FOR DELETE
TO authenticated
USING (auth.uid() = instructor_id);

-- Add trigger for updated_at
CREATE TRIGGER update_instructor_module_notes_updated_at
BEFORE UPDATE ON public.instructor_module_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_instructor_module_notes_progress 
ON public.instructor_module_notes(module_progress_id);

CREATE INDEX idx_instructor_module_notes_instructor 
ON public.instructor_module_notes(instructor_id);