-- Fix security_invoker on the public_external_courses_view
-- This ensures the view runs with the calling user's permissions, not the definer's
ALTER VIEW public.public_external_courses_view SET (security_invoker = on);