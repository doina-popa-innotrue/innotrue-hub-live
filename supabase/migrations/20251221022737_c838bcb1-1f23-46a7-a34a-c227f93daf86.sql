-- Add UPDATE policy to prevent users from modifying shares they didn't create
CREATE POLICY "Users can only update their own shares"
ON public.user_assessment_shares
FOR UPDATE
USING (auth.uid() = shared_by_user_id)
WITH CHECK (auth.uid() = shared_by_user_id);