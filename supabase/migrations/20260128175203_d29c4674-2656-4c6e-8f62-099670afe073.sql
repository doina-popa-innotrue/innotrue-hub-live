-- Allow users to manage their own exclusion status for GDPR compliance
-- Users can add themselves to exclusion list (decline analytics) or remove themselves (accept analytics)

CREATE POLICY "Users can insert their own exclusion"
  ON public.analytics_excluded_users
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exclusion"
  ON public.analytics_excluded_users
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own exclusion status"
  ON public.analytics_excluded_users
  FOR SELECT
  USING (auth.uid() = user_id);