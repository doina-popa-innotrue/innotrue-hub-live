-- Table 1: Client+module specific instructor/coach assignments
-- Allows assigning a specific instructor/coach to a client for a personalized module
CREATE TABLE public.enrollment_module_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(enrollment_id, module_id),
    CONSTRAINT at_least_one_staff CHECK (instructor_id IS NOT NULL OR coach_id IS NOT NULL)
);

-- Table 2: Instructor's Cal.com child event type per module type
-- Maps instructor + module_type to their specific Cal.com managed event child ID
CREATE TABLE public.instructor_calcom_event_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    module_type TEXT NOT NULL REFERENCES public.module_types(name) ON DELETE CASCADE,
    child_event_type_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(instructor_id, module_type)
);

-- Enable RLS
ALTER TABLE public.enrollment_module_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_calcom_event_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollment_module_staff
-- Admins can do everything
CREATE POLICY "Admins can manage enrollment_module_staff"
ON public.enrollment_module_staff
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Instructors can view assignments where they are the instructor
CREATE POLICY "Instructors can view their assignments"
ON public.enrollment_module_staff
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'instructor') 
    AND instructor_id = auth.uid()
);

-- Coaches can view assignments where they are the coach
CREATE POLICY "Coaches can view their assignments"
ON public.enrollment_module_staff
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'coach') 
    AND coach_id = auth.uid()
);

-- Clients can view their own enrollment staff assignments
CREATE POLICY "Clients can view their enrollment staff"
ON public.enrollment_module_staff
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.client_enrollments ce
        WHERE ce.id = enrollment_id
        AND ce.client_user_id = auth.uid()
    )
);

-- RLS Policies for instructor_calcom_event_types
-- Admins can do everything
CREATE POLICY "Admins can manage instructor_calcom_event_types"
ON public.instructor_calcom_event_types
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Instructors can view their own event type mappings
CREATE POLICY "Instructors can view their event types"
ON public.instructor_calcom_event_types
FOR SELECT
TO authenticated
USING (instructor_id = auth.uid());

-- Authenticated users can view instructor event types for booking purposes
CREATE POLICY "Authenticated users can view instructor event types for booking"
ON public.instructor_calcom_event_types
FOR SELECT
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX idx_enrollment_module_staff_enrollment ON public.enrollment_module_staff(enrollment_id);
CREATE INDEX idx_enrollment_module_staff_module ON public.enrollment_module_staff(module_id);
CREATE INDEX idx_enrollment_module_staff_instructor ON public.enrollment_module_staff(instructor_id);
CREATE INDEX idx_enrollment_module_staff_coach ON public.enrollment_module_staff(coach_id);
CREATE INDEX idx_instructor_calcom_event_types_instructor ON public.instructor_calcom_event_types(instructor_id);
CREATE INDEX idx_instructor_calcom_event_types_module_type ON public.instructor_calcom_event_types(module_type);

-- Triggers for updated_at
CREATE TRIGGER update_enrollment_module_staff_updated_at
BEFORE UPDATE ON public.enrollment_module_staff
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instructor_calcom_event_types_updated_at
BEFORE UPDATE ON public.instructor_calcom_event_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();