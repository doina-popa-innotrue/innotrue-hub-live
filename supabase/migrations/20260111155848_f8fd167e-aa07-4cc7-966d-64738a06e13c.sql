-- Create managed_clients table for non-user clients
CREATE TABLE public.managed_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_managed_clients_email ON public.managed_clients(email);
CREATE INDEX idx_managed_clients_created_by ON public.managed_clients(created_by);
CREATE INDEX idx_managed_clients_linked_user ON public.managed_clients(linked_user_id);

-- Add managed_client_id to client_enrollments
ALTER TABLE public.client_enrollments 
  ALTER COLUMN client_user_id DROP NOT NULL;

ALTER TABLE public.client_enrollments 
  ADD COLUMN managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE CASCADE;

-- Add check constraint: must have either client_user_id OR managed_client_id
ALTER TABLE public.client_enrollments
  ADD CONSTRAINT enrollment_client_check 
  CHECK (
    (client_user_id IS NOT NULL AND managed_client_id IS NULL) OR
    (client_user_id IS NULL AND managed_client_id IS NOT NULL)
  );

CREATE INDEX idx_enrollments_managed_client ON public.client_enrollments(managed_client_id);

-- Enable RLS on managed_clients
ALTER TABLE public.managed_clients ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage all managed_clients"
  ON public.managed_clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Instructors/coaches can view managed clients in their programs
CREATE POLICY "Instructors can view managed_clients in their programs"
  ON public.managed_clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      JOIN public.program_instructors pi ON pi.program_id = ce.program_id
      WHERE ce.managed_client_id = managed_clients.id
        AND pi.instructor_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_enrollments ce
      JOIN public.program_coaches pc ON pc.program_id = ce.program_id
      WHERE ce.managed_client_id = managed_clients.id
        AND pc.coach_id = auth.uid()
    )
  );

-- Creators can manage their own managed clients
CREATE POLICY "Creators can manage their managed_clients"
  ON public.managed_clients
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_managed_clients_updated_at
  BEFORE UPDATE ON public.managed_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();