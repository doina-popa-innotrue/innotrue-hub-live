-- First drop the storage policy that depends on is_shared_with_coach
DROP POLICY IF EXISTS "Coaches can view shared assessments" ON storage.objects;

-- Drop the user_assessments policy that uses the boolean flag
DROP POLICY IF EXISTS "Coaches can view shared assessments from their clients" ON public.user_assessments;

-- Create user_assessment_shares table for explicit per-assessment sharing
CREATE TABLE public.user_assessment_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_assessment_id UUID NOT NULL REFERENCES public.user_assessments(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  shared_by_user_id UUID NOT NULL,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_assessment_id, shared_with_user_id)
);

-- Enable RLS
ALTER TABLE public.user_assessment_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_assessment_shares
CREATE POLICY "Users can view shares for their assessments"
ON public.user_assessment_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_assessments ua
    WHERE ua.id = user_assessment_shares.user_assessment_id
    AND ua.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert shares for their assessments"
ON public.user_assessment_shares
FOR INSERT
WITH CHECK (
  auth.uid() = shared_by_user_id
  AND EXISTS (
    SELECT 1 FROM public.user_assessments ua
    WHERE ua.id = user_assessment_shares.user_assessment_id
    AND ua.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete shares for their assessments"
ON public.user_assessment_shares
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_assessments ua
    WHERE ua.id = user_assessment_shares.user_assessment_id
    AND ua.user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can view their shares"
ON public.user_assessment_shares
FOR SELECT
USING (auth.uid() = shared_with_user_id);

CREATE POLICY "Admins can manage all shares"
ON public.user_assessment_shares
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create new policy on user_assessments using the shares table
CREATE POLICY "Users with explicit share can view assessments"
ON public.user_assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_assessment_shares uas
    WHERE uas.user_assessment_id = user_assessments.id
    AND uas.shared_with_user_id = auth.uid()
  )
);

-- Create new storage policy using the shares table
CREATE POLICY "Users with explicit share can view assessment files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'psychometric-assessments'
  AND EXISTS (
    SELECT 1 FROM public.user_assessments ua
    JOIN public.user_assessment_shares uas ON uas.user_assessment_id = ua.id
    WHERE ua.file_path = objects.name
    AND uas.shared_with_user_id = auth.uid()
  )
);

-- Now drop the is_shared_with_coach column
ALTER TABLE public.user_assessments DROP COLUMN is_shared_with_coach;