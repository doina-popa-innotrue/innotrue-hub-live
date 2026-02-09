-- Create credit_source_types lookup table
CREATE TABLE public.credit_source_types (
  key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_expiry_months INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_source_types ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed for FK validation)
CREATE POLICY "Anyone can read credit source types"
  ON public.credit_source_types FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage credit source types"
  ON public.credit_source_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert existing values plus admin_grant
INSERT INTO public.credit_source_types (key, display_name, description, default_expiry_months) VALUES
  ('subscription', 'Subscription', 'Credits from subscription plan', NULL),
  ('purchase', 'Purchase', 'Credits purchased by user', 12),
  ('grant', 'Grant', 'Credits granted by system', 12),
  ('admin_grant', 'Admin Grant', 'Discretionary credits granted by admin', 12),
  ('rollover', 'Rollover', 'Unused credits rolled over from previous period', 3),
  ('plan', 'Plan', 'Credits from subscription plan allocation', NULL),
  ('program', 'Program', 'Credits from program enrollment', NULL),
  ('addon', 'Add-on', 'Credits from purchased add-on', 12);

-- Drop the existing CHECK constraint
ALTER TABLE public.credit_batches DROP CONSTRAINT credit_batches_source_type_check;

-- Add foreign key to the lookup table
ALTER TABLE public.credit_batches 
  ADD CONSTRAINT credit_batches_source_type_fkey 
  FOREIGN KEY (source_type) REFERENCES public.credit_source_types(key);

-- Create trigger for updated_at
CREATE TRIGGER update_credit_source_types_updated_at
  BEFORE UPDATE ON public.credit_source_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();