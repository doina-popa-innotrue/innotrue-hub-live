-- Add fields to track client-initiated sessions
ALTER TABLE public.module_sessions 
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'staff' CHECK (source IN ('staff', 'client_request', 'client_external')),
ADD COLUMN IF NOT EXISTS request_notes TEXT,
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferred_date TIMESTAMP WITH TIME ZONE;

-- Add RLS policy for clients to create their own session requests/external bookings
CREATE POLICY "Clients can create session requests for their enrollments"
ON public.module_sessions
FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND source IN ('client_request', 'client_external')
  AND EXISTS (
    SELECT 1 FROM client_enrollments ce
    JOIN module_progress mp ON mp.enrollment_id = ce.id
    WHERE ce.client_user_id = auth.uid()
    AND mp.module_id = module_sessions.module_id
    AND (module_sessions.enrollment_id IS NULL OR module_sessions.enrollment_id = ce.id)
  )
);

-- Allow clients to update their own pending requests (e.g., add meeting link)
CREATE POLICY "Clients can update their own session requests"
ON public.module_sessions
FOR UPDATE
USING (
  requested_by = auth.uid()
  AND source IN ('client_request', 'client_external')
)
WITH CHECK (
  requested_by = auth.uid()
  AND source IN ('client_request', 'client_external')
);