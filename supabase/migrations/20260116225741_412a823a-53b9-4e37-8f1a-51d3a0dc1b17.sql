
-- Phase 1: B2B Multi-Tenancy Foundation

-- Create organization role enum
CREATE TYPE public.org_role AS ENUM ('org_admin', 'org_manager', 'org_member');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  website TEXT,
  industry TEXT,
  size_range TEXT, -- e.g., '1-10', '11-50', '51-200', '201-500', '500+'
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create organization members table (links users to orgs)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'org_member',
  title TEXT, -- Job title within the org
  department TEXT,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Each user can only be in one organization
  UNIQUE (user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has org role
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Function to check if user is any kind of org admin/manager
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('org_admin', 'org_manager')
      AND is_active = true
  )
$$;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$$;

-- Function to check if user is in same org as another user
CREATE OR REPLACE FUNCTION public.is_same_organization(_user_id_1 UUID, _user_id_2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = _user_id_1
      AND om2.user_id = _user_id_2
      AND om1.is_active = true
      AND om2.is_active = true
  )
$$;

-- RLS Policies for organizations

-- Platform admins can see all organizations
CREATE POLICY "Platform admins can view all organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Platform admins can manage all organizations
CREATE POLICY "Platform admins can manage all organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Org members can view their own organization
CREATE POLICY "Org members can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND is_active = true
  )
);

-- Org admins can update their organization
CREATE POLICY "Org admins can update their organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  public.has_org_role(auth.uid(), id, 'org_admin')
);

-- RLS Policies for organization_members

-- Platform admins can see all members
CREATE POLICY "Platform admins can view all org members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Platform admins can manage all members
CREATE POLICY "Platform admins can manage all org members"
ON public.organization_members
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Org members can view members of their own org
CREATE POLICY "Org members can view their org members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Org admins can manage members of their org
CREATE POLICY "Org admins can insert org members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_admin_or_manager(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can update org members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  public.is_org_admin_or_manager(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can delete org members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  public.is_org_admin_or_manager(auth.uid(), organization_id)
);

-- Users can view their own membership
CREATE POLICY "Users can view own membership"
ON public.organization_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
