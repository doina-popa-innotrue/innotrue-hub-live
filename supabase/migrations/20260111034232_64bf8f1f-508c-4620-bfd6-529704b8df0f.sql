-- Add preferred_tier column to program_interest_registrations table
ALTER TABLE public.program_interest_registrations
ADD COLUMN preferred_tier text;

-- Create tier_upgrade_requests table for enrolled users to request tier upgrades
CREATE TABLE public.tier_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES client_enrollments(id) ON DELETE CASCADE,
  current_tier text NOT NULL,
  requested_tier text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, status) -- Only one pending request per enrollment
);

-- Enable RLS
ALTER TABLE public.tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own upgrade requests
CREATE POLICY "Users can view own tier upgrade requests"
ON public.tier_upgrade_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own upgrade requests
CREATE POLICY "Users can create own tier upgrade requests"
ON public.tier_upgrade_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all upgrade requests
CREATE POLICY "Admins can view all tier upgrade requests"
ON public.tier_upgrade_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update upgrade requests
CREATE POLICY "Admins can update tier upgrade requests"
ON public.tier_upgrade_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tier_upgrade_requests_updated_at
BEFORE UPDATE ON public.tier_upgrade_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_tier_upgrade_requests_enrollment ON public.tier_upgrade_requests(enrollment_id);
CREATE INDEX idx_tier_upgrade_requests_status ON public.tier_upgrade_requests(status);