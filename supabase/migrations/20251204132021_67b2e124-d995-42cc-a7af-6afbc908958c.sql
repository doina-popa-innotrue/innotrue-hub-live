-- Create group join type enum
CREATE TYPE public.group_join_type AS ENUM ('invitation_only', 'open');

-- Create group status enum
CREATE TYPE public.group_status AS ENUM ('draft', 'active', 'completed', 'archived');

-- Create group membership status enum
CREATE TYPE public.group_membership_status AS ENUM ('active', 'pending', 'left');

-- Create group membership role enum
CREATE TYPE public.group_member_role AS ENUM ('member', 'leader');

-- Groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  theme TEXT,
  join_type public.group_join_type NOT NULL DEFAULT 'invitation_only',
  status public.group_status NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  circle_group_id TEXT,
  circle_group_url TEXT,
  max_members INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group memberships table
CREATE TABLE public.group_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.group_member_role NOT NULL DEFAULT 'member',
  status public.group_membership_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(group_id, user_id)
);

-- Group tasks table (separate from personal tasks)
CREATE TABLE public.group_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group check-ins table
CREATE TABLE public.group_check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group notes/deliverables table
CREATE TABLE public.group_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  note_type TEXT NOT NULL DEFAULT 'note',
  file_path TEXT,
  file_name TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group interest registrations (for open groups)
CREATE TABLE public.group_interest_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_interest_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Admins can manage all groups"
ON public.groups FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view their groups"
ON public.groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = groups.id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Users can view open groups"
ON public.groups FOR SELECT
USING (join_type = 'open' AND status = 'active');

-- RLS Policies for group_memberships
CREATE POLICY "Admins can manage all memberships"
ON public.group_memberships FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view memberships of their groups"
ON public.group_memberships FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_memberships gm
    WHERE gm.group_id = group_memberships.group_id
    AND gm.user_id = auth.uid()
    AND gm.status = 'active'
  )
);

-- RLS Policies for group_tasks (collaborative - members can add/edit tasks)
CREATE POLICY "Admins can manage all group tasks"
ON public.group_tasks FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Group members can view group tasks"
ON public.group_tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_tasks.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Group members can create group tasks"
ON public.group_tasks FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_tasks.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Group members can update group tasks"
ON public.group_tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_tasks.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Task creators can delete their tasks"
ON public.group_tasks FOR DELETE
USING (auth.uid() = created_by);

-- RLS Policies for group_check_ins
CREATE POLICY "Admins can manage all check-ins"
ON public.group_check_ins FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Group members can view check-ins"
ON public.group_check_ins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_check_ins.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Users can create their own check-ins"
ON public.group_check_ins FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_check_ins.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Users can update their own check-ins"
ON public.group_check_ins FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own check-ins"
ON public.group_check_ins FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for group_notes (collaborative)
CREATE POLICY "Admins can manage all group notes"
ON public.group_notes FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Group members can view group notes"
ON public.group_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_notes.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Group members can create group notes"
ON public.group_notes FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_notes.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Group members can update group notes"
ON public.group_notes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.group_memberships
    WHERE group_memberships.group_id = group_notes.group_id
    AND group_memberships.user_id = auth.uid()
    AND group_memberships.status = 'active'
  )
);

CREATE POLICY "Note creators can delete their notes"
ON public.group_notes FOR DELETE
USING (auth.uid() = created_by);

-- RLS Policies for group_interest_registrations
CREATE POLICY "Admins can manage all interest registrations"
ON public.group_interest_registrations FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own interest registrations"
ON public.group_interest_registrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can register interest in open groups"
ON public.group_interest_registrations FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.groups
    WHERE groups.id = group_interest_registrations.group_id
    AND groups.join_type = 'open'
    AND groups.status = 'active'
  )
);

-- Create storage bucket for group notes/deliverables
INSERT INTO storage.buckets (id, name, public) VALUES ('group-notes', 'group-notes', false);

-- Storage policies for group-notes bucket
CREATE POLICY "Group members can view group note files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'group-notes' AND
  EXISTS (
    SELECT 1 FROM public.group_memberships gm
    JOIN public.group_notes gn ON gn.group_id = gm.group_id
    WHERE gm.user_id = auth.uid()
    AND gm.status = 'active'
    AND gn.file_path = name
  )
);

CREATE POLICY "Group members can upload group note files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-notes' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Group members can delete their own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-notes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add updated_at triggers
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_tasks_updated_at
  BEFORE UPDATE ON public.group_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_notes_updated_at
  BEFORE UPDATE ON public.group_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_interest_registrations_updated_at
  BEFORE UPDATE ON public.group_interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();