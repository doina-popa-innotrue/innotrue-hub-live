
-- Create assessment types table (admin-defined templates)
CREATE TABLE public.module_assessment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  structure JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of field definitions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for modules and assessment types
CREATE TABLE public.module_assessment_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  assessment_type_id UUID NOT NULL REFERENCES public.module_assessment_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_id, assessment_type_id)
);

-- Create assessments table (filled by coach/instructor for a client's module progress)
CREATE TABLE public.module_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_progress_id UUID NOT NULL REFERENCES public.module_progress(id) ON DELETE CASCADE,
  assessment_type_id UUID NOT NULL REFERENCES public.module_assessment_types(id) ON DELETE CASCADE,
  assessor_id UUID NOT NULL, -- coach/instructor who filled it
  responses JSONB NOT NULL DEFAULT '{}'::jsonb, -- Filled responses matching structure
  overall_score NUMERIC(5,2),
  overall_comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_progress_id, assessment_type_id)
);

-- Create assessment attachments table
CREATE TABLE public.module_assessment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.module_assessments(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('file', 'image', 'link')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for assessment attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('module-assessment-attachments', 'module-assessment-attachments', false);

-- Enable RLS on all tables
ALTER TABLE public.module_assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_assessment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS for module_assessment_types (admins manage, everyone can view active)
CREATE POLICY "Admins can manage assessment types"
ON public.module_assessment_types FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active assessment types"
ON public.module_assessment_types FOR SELECT
USING (is_active = true);

-- RLS for module_assessment_assignments (admins manage, authenticated can view)
CREATE POLICY "Admins can manage assessment assignments"
ON public.module_assessment_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view assessment assignments"
ON public.module_assessment_assignments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS for module_assessments
CREATE POLICY "Admins can manage all assessments"
ON public.module_assessments FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Assessors can manage their own assessments"
ON public.module_assessments FOR ALL
USING (auth.uid() = assessor_id)
WITH CHECK (auth.uid() = assessor_id);

CREATE POLICY "Clients can view completed assessments on their modules"
ON public.module_assessments FOR SELECT
USING (
  status = 'completed' AND
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    WHERE mp.id = module_assessments.module_progress_id
    AND ce.client_user_id = auth.uid()
    AND mp.status = 'completed'
  )
);

CREATE POLICY "Instructors can view assessments for their program modules"
ON public.module_assessments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN program_instructors pi ON pi.program_id = ce.program_id
    WHERE mp.id = module_assessments.module_progress_id
    AND pi.instructor_id = auth.uid()
  )
);

CREATE POLICY "Coaches can view assessments for their assigned clients"
ON public.module_assessments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_progress mp
    JOIN client_enrollments ce ON ce.id = mp.enrollment_id
    JOIN client_coaches cc ON cc.client_id = ce.client_user_id
    WHERE mp.id = module_assessments.module_progress_id
    AND cc.coach_id = auth.uid()
  )
);

-- RLS for module_assessment_attachments
CREATE POLICY "Admins can manage all attachments"
ON public.module_assessment_attachments FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Assessors can manage attachments on their assessments"
ON public.module_assessment_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM module_assessments ma
    WHERE ma.id = module_assessment_attachments.assessment_id
    AND ma.assessor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM module_assessments ma
    WHERE ma.id = module_assessment_attachments.assessment_id
    AND ma.assessor_id = auth.uid()
  )
);

CREATE POLICY "Users can view attachments on assessments they can view"
ON public.module_assessment_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM module_assessments ma
    WHERE ma.id = module_assessment_attachments.assessment_id
    AND (
      ma.assessor_id = auth.uid() OR
      has_role(auth.uid(), 'admin') OR
      (ma.status = 'completed' AND EXISTS (
        SELECT 1 FROM module_progress mp
        JOIN client_enrollments ce ON ce.id = mp.enrollment_id
        WHERE mp.id = ma.module_progress_id
        AND (ce.client_user_id = auth.uid() AND mp.status = 'completed')
      ))
    )
  )
);

-- Storage policies for assessment attachments
CREATE POLICY "Authenticated users can upload assessment attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'module-assessment-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view assessment attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'module-assessment-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete their assessment attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'module-assessment-attachments' AND auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_module_assessment_types_updated_at
BEFORE UPDATE ON public.module_assessment_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_module_assessments_updated_at
BEFORE UPDATE ON public.module_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
