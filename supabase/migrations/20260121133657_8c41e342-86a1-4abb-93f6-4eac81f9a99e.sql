-- Add foreign key relationship from capability_snapshots.user_id to profiles.id
-- This enables proper joins and ensures data integrity
-- user_id represents the person being assessed (either self-assessment or evaluated by instructor)

ALTER TABLE public.capability_snapshots
ADD CONSTRAINT capability_snapshots_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;