-- Add is_private to external_courses (already has is_public)
ALTER TABLE public.external_courses
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Add is_private to module_assignments
ALTER TABLE public.module_assignments
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Add is_private to user_skills (already has is_public)
ALTER TABLE public.user_skills
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Add is_private to client_badges (already has is_public)
ALTER TABLE public.client_badges
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;