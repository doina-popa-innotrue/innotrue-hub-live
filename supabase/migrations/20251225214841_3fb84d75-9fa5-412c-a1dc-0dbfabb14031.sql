-- Add foreign key constraint from group_memberships.user_id to profiles.id
ALTER TABLE public.group_memberships
ADD CONSTRAINT group_memberships_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;