-- Create security definer functions to break RLS recursion

-- Function to check if user owns an ac_assessment_result
CREATE OR REPLACE FUNCTION public.owns_ac_assessment_result(_user_id uuid, _result_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ac_assessment_results
    WHERE id = _result_id AND user_id = _user_id
  )
$$;

-- Function to check if user has shared access to an ac_assessment_result
CREATE OR REPLACE FUNCTION public.has_shared_access_to_ac_result(_user_id uuid, _result_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ac_assessment_shares
    WHERE assessment_result_id = _result_id AND shared_with_user_id = _user_id
  )
$$;

-- Function to check if user owns a user_assessment
CREATE OR REPLACE FUNCTION public.owns_user_assessment(_user_id uuid, _assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_assessments
    WHERE id = _assessment_id AND user_id = _user_id
  )
$$;

-- Function to check if user has shared access to a user_assessment
CREATE OR REPLACE FUNCTION public.has_shared_access_to_user_assessment(_user_id uuid, _assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_assessment_shares
    WHERE user_assessment_id = _assessment_id AND shared_with_user_id = _user_id
  )
$$;

-- Drop and recreate policies for ac_assessment_results
DROP POLICY IF EXISTS "Coaches and instructors can view shared results" ON public.ac_assessment_results;
CREATE POLICY "Coaches and instructors can view shared results" ON public.ac_assessment_results
FOR SELECT USING (public.has_shared_access_to_ac_result(auth.uid(), id));

-- Drop and recreate policies for ac_assessment_shares
DROP POLICY IF EXISTS "Users can manage shares for their results" ON public.ac_assessment_shares;
CREATE POLICY "Users can manage shares for their results" ON public.ac_assessment_shares
FOR ALL USING (public.owns_ac_assessment_result(auth.uid(), assessment_result_id));

-- Drop and recreate policies for user_assessments
DROP POLICY IF EXISTS "Users with explicit share can view assessments" ON public.user_assessments;
CREATE POLICY "Users with explicit share can view assessments" ON public.user_assessments
FOR SELECT USING (public.has_shared_access_to_user_assessment(auth.uid(), id));

-- Drop and recreate policies for user_assessment_shares
DROP POLICY IF EXISTS "Users can view shares for their assessments" ON public.user_assessment_shares;
CREATE POLICY "Users can view shares for their assessments" ON public.user_assessment_shares
FOR SELECT USING (public.owns_user_assessment(auth.uid(), user_assessment_id));

DROP POLICY IF EXISTS "Users can delete shares for their assessments" ON public.user_assessment_shares;
CREATE POLICY "Users can delete shares for their assessments" ON public.user_assessment_shares
FOR DELETE USING (public.owns_user_assessment(auth.uid(), user_assessment_id));

DROP POLICY IF EXISTS "Users can insert shares for their assessments" ON public.user_assessment_shares;
CREATE POLICY "Users can insert shares for their assessments" ON public.user_assessment_shares
FOR INSERT WITH CHECK (
  auth.uid() = shared_by_user_id 
  AND public.owns_user_assessment(auth.uid(), user_assessment_id)
);