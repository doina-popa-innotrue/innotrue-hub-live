-- Create external courses table for tracking courses from other providers
CREATE TABLE public.external_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  planned_date DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own external courses"
ON public.external_courses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external courses"
ON public.external_courses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external courses"
ON public.external_courses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external courses"
ON public.external_courses
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all external courses
CREATE POLICY "Admins can view all external courses"
ON public.external_courses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_external_courses_updated_at
BEFORE UPDATE ON public.external_courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for user_id lookups
CREATE INDEX idx_external_courses_user_id ON public.external_courses(user_id);
CREATE INDEX idx_external_courses_status ON public.external_courses(status);