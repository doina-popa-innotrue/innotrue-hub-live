-- Create coach_module_feedback table for coach feedback on client module progress
CREATE TABLE public.coach_module_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_progress_id UUID NOT NULL REFERENCES public.module_progress(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to ensure one feedback per coach per module_progress
CREATE UNIQUE INDEX coach_module_feedback_unique ON public.coach_module_feedback(module_progress_id, coach_id);

-- Enable RLS
ALTER TABLE public.coach_module_feedback ENABLE ROW LEVEL SECURITY;

-- Admins can manage all coach feedback
CREATE POLICY "Admins can manage all coach feedback"
ON public.coach_module_feedback
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Coaches can insert their own feedback
CREATE POLICY "Coaches can insert their own feedback"
ON public.coach_module_feedback
FOR INSERT
WITH CHECK (auth.uid() = coach_id);

-- Coaches can update their own feedback
CREATE POLICY "Coaches can update their own feedback"
ON public.coach_module_feedback
FOR UPDATE
USING (auth.uid() = coach_id)
WITH CHECK (auth.uid() = coach_id);

-- Coaches can delete their own feedback
CREATE POLICY "Coaches can delete their own feedback"
ON public.coach_module_feedback
FOR DELETE
USING (auth.uid() = coach_id);

-- Coaches can view their own feedback
CREATE POLICY "Coaches can view their own feedback"
ON public.coach_module_feedback
FOR SELECT
USING (auth.uid() = coach_id OR has_role(auth.uid(), 'admin'::app_role));

-- Clients can view feedback on their own module progress
CREATE POLICY "Clients can view feedback on their modules"
ON public.coach_module_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE mp.id = coach_module_feedback.module_progress_id
    AND ce.client_user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_coach_module_feedback_updated_at
BEFORE UPDATE ON public.coach_module_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();