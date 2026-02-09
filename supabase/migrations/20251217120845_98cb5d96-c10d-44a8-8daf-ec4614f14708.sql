-- Create feedback template types table (admin-defined structures)
CREATE TABLE public.feedback_template_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add structured fields to coach_module_feedback
ALTER TABLE public.coach_module_feedback
ADD COLUMN template_type_id UUID REFERENCES public.feedback_template_types(id),
ADD COLUMN structured_responses JSONB DEFAULT '{}'::jsonb;

-- Create coach feedback attachments table
CREATE TABLE public.coach_feedback_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.coach_module_feedback(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  attachment_type TEXT NOT NULL, -- 'file', 'image', 'link'
  file_path TEXT,
  url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_template_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_feedback_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for feedback_template_types
CREATE POLICY "Admins can manage feedback templates"
ON public.feedback_template_types FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active templates"
ON public.feedback_template_types FOR SELECT
USING (is_active = true);

-- RLS for coach_feedback_attachments
CREATE POLICY "Admins can manage all feedback attachments"
ON public.coach_feedback_attachments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coaches can manage their feedback attachments"
ON public.coach_feedback_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM coach_module_feedback cmf
    WHERE cmf.id = coach_feedback_attachments.feedback_id
    AND cmf.coach_id = auth.uid()
  )
);

CREATE POLICY "Clients can view attachments on their feedback"
ON public.coach_feedback_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coach_module_feedback cmf
    JOIN module_progress mp ON mp.id = cmf.module_progress_id
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE cmf.id = coach_feedback_attachments.feedback_id
    AND ce.client_user_id = auth.uid()
  )
);

-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('coach-feedback-attachments', 'coach-feedback-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Coaches can upload feedback attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'coach-feedback-attachments' 
  AND auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'instructor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users can view feedback attachments they have access to"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'coach-feedback-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Coaches can delete their feedback attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'coach-feedback-attachments'
  AND auth.uid() IS NOT NULL
  AND (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'instructor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);