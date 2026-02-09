-- Enable RLS on email_change_requests table
ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own email change requests
CREATE POLICY "Users can insert their own email change requests"
ON public.email_change_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own email change requests
CREATE POLICY "Users can view their own email change requests"
ON public.email_change_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to delete their own email change requests (for cancellation)
CREATE POLICY "Users can delete their own email change requests"
ON public.email_change_requests
FOR DELETE
USING (auth.uid() = user_id);