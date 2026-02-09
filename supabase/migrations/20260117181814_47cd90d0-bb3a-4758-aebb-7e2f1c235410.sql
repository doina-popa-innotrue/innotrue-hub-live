-- Create staff_profiles table for partner vs employee tracking
CREATE TABLE public.staff_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'partner' CHECK (relationship_type IN ('employee', 'partner', 'contractor')),
  company_name TEXT,
  contract_start_date DATE,
  contract_end_date DATE,
  specializations TEXT[],
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

-- Admins can manage all staff profiles
CREATE POLICY "Admins can manage staff profiles"
ON public.staff_profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Staff can view their own profile
CREATE POLICY "Staff can view own profile"
ON public.staff_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Staff can update their own profile (limited fields handled in app)
CREATE POLICY "Staff can update own profile"
ON public.staff_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_staff_profiles_updated_at
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_staff_profiles_relationship_type ON public.staff_profiles(relationship_type);
CREATE INDEX idx_staff_profiles_is_active ON public.staff_profiles(is_active);