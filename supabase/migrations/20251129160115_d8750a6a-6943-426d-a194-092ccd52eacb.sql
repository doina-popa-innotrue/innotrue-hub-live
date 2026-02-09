-- Step 1: Add instructor and coach roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';