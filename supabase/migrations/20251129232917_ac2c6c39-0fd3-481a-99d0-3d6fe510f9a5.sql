-- Create module_reflections table
CREATE TABLE IF NOT EXISTS public.module_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_progress_id UUID NOT NULL REFERENCES public.module_progress(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for module_reflections
CREATE POLICY "Users can view their own module reflections"
  ON public.module_reflections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own module reflections"
  ON public.module_reflections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own module reflections"
  ON public.module_reflections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own module reflections"
  ON public.module_reflections
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all module reflections"
  ON public.module_reflections
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors and coaches can view reflections for their modules"
  ON public.module_reflections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM module_progress mp
      WHERE mp.id = module_reflections.module_progress_id
      AND (
        EXISTS (
          SELECT 1 FROM module_instructors mi
          WHERE mi.module_id = mp.module_id AND mi.instructor_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM module_coaches mc
          WHERE mc.module_id = mp.module_id AND mc.coach_id = auth.uid()
        )
      )
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_module_reflections_updated_at
  BEFORE UPDATE ON public.module_reflections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();