-- Add values and drives to existing user_interests if columns don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_interests' AND column_name='values') THEN
    ALTER TABLE public.user_interests ADD COLUMN values TEXT[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_interests' AND column_name='drives') THEN
    ALTER TABLE public.user_interests ADD COLUMN drives TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Create psychometric_assessments table (admin-defined)
CREATE TABLE IF NOT EXISTS public.psychometric_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on psychometric_assessments
ALTER TABLE public.psychometric_assessments ENABLE ROW LEVEL SECURITY;

-- RLS policies for psychometric_assessments
CREATE POLICY "Everyone can view active assessments"
  ON public.psychometric_assessments FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage assessments"
  ON public.psychometric_assessments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_assessments table (uploaded files)
CREATE TABLE IF NOT EXISTS public.user_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_id UUID REFERENCES public.psychometric_assessments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  is_shared_with_coach BOOLEAN DEFAULT false,
  notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_assessments
ALTER TABLE public.user_assessments ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_assessments
CREATE POLICY "Users can view their own assessments"
  ON public.user_assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessments"
  ON public.user_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments"
  ON public.user_assessments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assessments"
  ON public.user_assessments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view shared assessments from their clients"
  ON public.user_assessments FOR SELECT
  USING (
    is_shared_with_coach = true 
    AND EXISTS (
      SELECT 1 FROM public.client_coaches
      WHERE client_coaches.client_id = user_assessments.user_id
      AND client_coaches.coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all assessments"
  ON public.user_assessments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create assessment_interest_registrations table
CREATE TABLE IF NOT EXISTS public.assessment_interest_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES public.psychometric_assessments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, assessment_id)
);

-- Enable RLS on assessment_interest_registrations
ALTER TABLE public.assessment_interest_registrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for assessment_interest_registrations
CREATE POLICY "Users can view their own assessment interests"
  ON public.assessment_interest_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessment interests"
  ON public.assessment_interest_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assessment interests"
  ON public.assessment_interest_registrations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for assessments
INSERT INTO storage.buckets (id, name, public)
VALUES ('psychometric-assessments', 'psychometric-assessments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assessments
CREATE POLICY "Users can upload their own assessments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'psychometric-assessments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own assessments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'psychometric-assessments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own assessments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'psychometric-assessments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Coaches can view shared assessments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'psychometric-assessments'
    AND EXISTS (
      SELECT 1 FROM public.user_assessments ua
      JOIN public.client_coaches cc ON cc.client_id = ua.user_id
      WHERE ua.file_path = storage.objects.name
      AND ua.is_shared_with_coach = true
      AND cc.coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all assessments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'psychometric-assessments'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Create triggers for updated_at
CREATE TRIGGER update_psychometric_assessments_updated_at
  BEFORE UPDATE ON public.psychometric_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_assessments_updated_at
  BEFORE UPDATE ON public.user_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_interest_registrations_updated_at
  BEFORE UPDATE ON public.assessment_interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();