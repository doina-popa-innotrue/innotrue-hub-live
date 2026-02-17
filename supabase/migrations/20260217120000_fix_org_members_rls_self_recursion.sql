-- Fix: self-referential RLS recursion on organization_members
-- The "Org admins can update member sponsored plans" policy queries
-- organization_members itself inline, which triggers RLS → infinite recursion.
--
-- Solution: Replace inline query with existing has_org_role() SECURITY DEFINER
-- function, which already checks organization_id + role + is_active.

DROP POLICY IF EXISTS "Org admins can update member sponsored plans" ON public.organization_members;

CREATE POLICY "Org admins can update member sponsored plans"
ON public.organization_members
FOR UPDATE
USING (
  public.has_org_role(auth.uid(), organization_id, 'org_admin'::org_role)
)
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'org_admin'::org_role)
);
