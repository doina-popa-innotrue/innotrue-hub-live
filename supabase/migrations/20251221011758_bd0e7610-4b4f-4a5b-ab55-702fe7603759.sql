-- Add google_drive_folder_url column to groups table (admin-managed like calendly_event_url)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS google_drive_folder_url text;

-- Create table for group member links (members can add their own useful links)
CREATE TABLE public.group_member_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_member_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_member_links

-- Admins can manage all group member links
CREATE POLICY "Admins can manage all group member links"
ON public.group_member_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Group members can view all links in their group
CREATE POLICY "Group members can view group links"
ON public.group_member_links
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM group_memberships
  WHERE group_memberships.group_id = group_member_links.group_id
  AND group_memberships.user_id = auth.uid()
  AND group_memberships.status = 'active'::group_membership_status
));

-- Group members can create their own links
CREATE POLICY "Group members can create their own links"
ON public.group_member_links
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_memberships
    WHERE group_memberships.group_id = group_member_links.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'::group_membership_status
  )
);

-- Users can update their own links
CREATE POLICY "Users can update their own links"
ON public.group_member_links
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own links
CREATE POLICY "Users can delete their own links"
ON public.group_member_links
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_group_member_links_group_id ON public.group_member_links(group_id);
CREATE INDEX idx_group_member_links_user_id ON public.group_member_links(user_id);