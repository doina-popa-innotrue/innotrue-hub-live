-- Create module_sections table for multiple content sections per module
CREATE TABLE public.module_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  section_type TEXT NOT NULL DEFAULT 'content' CHECK (section_type IN ('content', 'separator')),
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient ordering queries
CREATE INDEX idx_module_sections_module_order ON public.module_sections(module_id, order_index);

-- Enable Row Level Security
ALTER TABLE public.module_sections ENABLE ROW LEVEL SECURITY;

-- Admins can manage all sections
CREATE POLICY "Admins can manage module sections"
ON public.module_sections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can manage sections for their program modules
CREATE POLICY "Instructors can manage sections for their modules"
ON public.module_sections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE pm.id = module_sections.module_id
    AND pi.instructor_id = auth.uid()
  )
);

-- Coaches can manage sections for their program modules
CREATE POLICY "Coaches can manage sections for their modules"
ON public.module_sections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE pm.id = module_sections.module_id
    AND pc.coach_id = auth.uid()
  )
);

-- Users can view sections for modules they have access to (enrolled or active programs)
CREATE POLICY "Users can view sections for accessible modules"
ON public.module_sections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM program_modules pm
    JOIN programs p ON p.id = pm.program_id
    WHERE pm.id = module_sections.module_id
    AND (
      p.is_active = true
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM client_enrollments ce
        WHERE ce.program_id = pm.program_id
        AND ce.client_user_id = auth.uid()
      )
    )
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_module_sections_updated_at
BEFORE UPDATE ON public.module_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();