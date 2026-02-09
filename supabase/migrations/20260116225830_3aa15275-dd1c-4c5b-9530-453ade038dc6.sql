
-- Fix overly permissive RLS policies by replacing FOR ALL with specific operation policies

-- Drop the FOR ALL policies
DROP POLICY IF EXISTS "Platform admins can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins can manage all org members" ON public.organization_members;

-- Replace with specific operation policies for organizations
CREATE POLICY "Platform admins can insert organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can update organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Replace with specific operation policies for organization_members
CREATE POLICY "Platform admins can insert org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can update org members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can delete org members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
