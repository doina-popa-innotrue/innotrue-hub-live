-- Add shared_with_instructor column to capability_snapshots
ALTER TABLE public.capability_snapshots 
ADD COLUMN shared_with_instructor boolean NOT NULL DEFAULT false;