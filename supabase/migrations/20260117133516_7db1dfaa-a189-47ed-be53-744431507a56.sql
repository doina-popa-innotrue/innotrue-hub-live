-- Add sponsored_plan_id to organization_members for org-sponsored access
-- This allows organizations to sponsor platform plan access for their members

ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS sponsored_plan_id UUID REFERENCES public.plans(id);

-- Add comment for documentation
COMMENT ON COLUMN public.organization_members.sponsored_plan_id IS 
'Optional plan sponsored by the organization for this member. User effective tier = MAX(personal_plan, highest_org_sponsored_plan)';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_org_members_sponsored_plan 
ON public.organization_members(sponsored_plan_id) 
WHERE sponsored_plan_id IS NOT NULL;

-- Add policy for org admins to update sponsored plans
CREATE POLICY "Org admins can update member sponsored plans"
ON public.organization_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'org_admin'
    AND om.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'org_admin'
    AND om.is_active = true
  )
);