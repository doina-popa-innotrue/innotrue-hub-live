-- Create admin audit log table
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for querying by admin user
CREATE INDEX idx_audit_logs_admin_user ON public.admin_audit_logs(admin_user_id);

-- Add index for querying by entity
CREATE INDEX idx_audit_logs_entity ON public.admin_audit_logs(entity_type, entity_id);

-- Add index for querying by date
CREATE INDEX idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Admins can insert audit logs
CREATE POLICY "Admins can create audit logs"
ON public.admin_audit_logs
FOR INSERT
WITH CHECK (auth.uid() = admin_user_id);

-- Add comment
COMMENT ON TABLE public.admin_audit_logs IS 'Tracks admin actions for compliance and debugging';