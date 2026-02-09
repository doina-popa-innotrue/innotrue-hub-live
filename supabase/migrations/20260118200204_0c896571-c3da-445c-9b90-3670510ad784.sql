
-- Fix overly permissive RLS policies

-- Drop the permissive policies
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can manage email queue" ON public.email_queue;

-- Notifications: Allow authenticated users to insert (for self-notifications) or use RPC
-- The create_notification function handles actual insertion with SECURITY DEFINER
CREATE POLICY "Authenticated can insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Email queue should only be managed via the create_notification function (SECURITY DEFINER)
-- No direct insert policy needed - the function handles it
-- For service role operations (edge functions), they bypass RLS anyway

-- Add admin policy for email_queue management
CREATE POLICY "Admins can view email queue"
ON public.email_queue FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email queue"
ON public.email_queue FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
