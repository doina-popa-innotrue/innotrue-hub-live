-- ActiveCampaign Assessment Types (admin-defined templates)
CREATE TABLE public.ac_assessment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ActiveCampaign Assessment Results (instances from webhooks)
CREATE TABLE public.ac_assessment_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_type_id UUID NOT NULL REFERENCES public.ac_assessment_types(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  ac_contact_id TEXT,
  ac_metadata JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  matched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assessment Result Shares (with coaches/instructors)
CREATE TABLE public.ac_assessment_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_result_id UUID NOT NULL REFERENCES public.ac_assessment_results(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assessment_result_id, shared_with_user_id)
);

-- ActiveCampaign Sign-up Intents
CREATE TABLE public.ac_signup_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  consent_given BOOLEAN DEFAULT false,
  plan_interest TEXT,
  ac_contact_id TEXT,
  ac_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  converted_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ac_assessment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_assessment_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_signup_intents ENABLE ROW LEVEL SECURITY;

-- Assessment Types: Admin only
CREATE POLICY "Admins can manage assessment types"
  ON public.ac_assessment_types FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Assessment Results: Users see their own, coaches/instructors see shared
CREATE POLICY "Users can view their own assessment results"
  ON public.ac_assessment_results FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Coaches and instructors can view shared results"
  ON public.ac_assessment_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ac_assessment_shares 
      WHERE assessment_result_id = ac_assessment_results.id 
      AND shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all assessment results"
  ON public.ac_assessment_results FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update their own assessment results"
  ON public.ac_assessment_results FOR UPDATE
  USING (user_id = auth.uid());

-- Assessment Shares: Owner can manage, shared users can view
CREATE POLICY "Users can manage shares for their results"
  ON public.ac_assessment_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ac_assessment_results 
      WHERE id = ac_assessment_shares.assessment_result_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can view their shares"
  ON public.ac_assessment_shares FOR SELECT
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Admins can manage all shares"
  ON public.ac_assessment_shares FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Sign-up Intents: Admin only
CREATE POLICY "Admins can manage signup intents"
  ON public.ac_signup_intents FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Indexes
CREATE INDEX idx_ac_assessment_results_user_id ON public.ac_assessment_results(user_id);
CREATE INDEX idx_ac_assessment_results_email ON public.ac_assessment_results(contact_email);
CREATE INDEX idx_ac_assessment_results_type ON public.ac_assessment_results(assessment_type_id);
CREATE INDEX idx_ac_assessment_shares_result ON public.ac_assessment_shares(assessment_result_id);
CREATE INDEX idx_ac_assessment_shares_shared_with ON public.ac_assessment_shares(shared_with_user_id);
CREATE INDEX idx_ac_signup_intents_status ON public.ac_signup_intents(status);
CREATE INDEX idx_ac_signup_intents_email ON public.ac_signup_intents(email);

-- Triggers for updated_at
CREATE TRIGGER update_ac_assessment_types_updated_at
  BEFORE UPDATE ON public.ac_assessment_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ac_assessment_results_updated_at
  BEFORE UPDATE ON public.ac_assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ac_signup_intents_updated_at
  BEFORE UPDATE ON public.ac_signup_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();