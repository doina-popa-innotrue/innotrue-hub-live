-- Create table to store TalentLMS course progress
CREATE TABLE public.talentlms_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talentlms_course_id TEXT NOT NULL,
  course_name TEXT,
  completion_status TEXT NOT NULL CHECK (completion_status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  time_spent_minutes INTEGER DEFAULT 0,
  test_score DECIMAL(5,2),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, talentlms_course_id)
);

-- Enable RLS
ALTER TABLE public.talentlms_progress ENABLE ROW LEVEL SECURITY;

-- Policies for users to view their own progress
CREATE POLICY "Users can view their own TalentLMS progress"
ON public.talentlms_progress
FOR SELECT
USING (auth.uid() = user_id);

-- Policies for admins to view all progress
CREATE POLICY "Admins can view all TalentLMS progress"
ON public.talentlms_progress
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Policies for admins to manage progress
CREATE POLICY "Admins can manage TalentLMS progress"
ON public.talentlms_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_talentlms_progress_updated_at
BEFORE UPDATE ON public.talentlms_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_talentlms_progress_user_id ON public.talentlms_progress(user_id);
CREATE INDEX idx_talentlms_progress_course_id ON public.talentlms_progress(talentlms_course_id);