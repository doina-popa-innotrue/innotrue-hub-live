-- Create storage bucket for module reflection resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('module-reflection-resources', 'module-reflection-resources', false)
ON CONFLICT (id) DO NOTHING;

-- Create table for module reflection resources
CREATE TABLE IF NOT EXISTS public.module_reflection_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_reflection_id UUID NOT NULL REFERENCES public.module_reflections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'image', 'link')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_reflection_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for module_reflection_resources
CREATE POLICY "Users can view their own reflection resources"
ON public.module_reflection_resources
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reflection resources"
ON public.module_reflection_resources
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflection resources"
ON public.module_reflection_resources
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reflection resources"
ON public.module_reflection_resources
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reflection resources"
ON public.module_reflection_resources
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors and coaches can view reflection resources for their modules"
ON public.module_reflection_resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.module_reflections mr
    JOIN public.module_progress mp ON mp.id = mr.module_progress_id
    WHERE mr.id = module_reflection_resources.module_reflection_id
    AND (
      EXISTS (
        SELECT 1 FROM public.module_instructors mi
        WHERE mi.module_id = mp.module_id
        AND mi.instructor_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.module_coaches mc
        WHERE mc.module_id = mp.module_id
        AND mc.coach_id = auth.uid()
      )
    )
  )
);

-- Storage policies for module-reflection-resources bucket
CREATE POLICY "Users can upload their own reflection resources"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'module-reflection-resources' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own reflection resources"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'module-reflection-resources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own reflection resources"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'module-reflection-resources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own reflection resources"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'module-reflection-resources'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create index for better query performance
CREATE INDEX idx_module_reflection_resources_reflection_id 
ON public.module_reflection_resources(module_reflection_id);

CREATE INDEX idx_module_reflection_resources_user_id 
ON public.module_reflection_resources(user_id);