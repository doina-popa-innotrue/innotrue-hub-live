-- Create table for account deletion requests
CREATE TABLE public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users can create their own deletion requests"
ON public.account_deletion_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own pending requests
CREATE POLICY "Users can update their own pending requests"
ON public.account_deletion_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Admins can view all requests
CREATE POLICY "Admins can view all deletion requests"
ON public.account_deletion_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any request
CREATE POLICY "Admins can update all deletion requests"
ON public.account_deletion_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_account_deletion_requests_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();