-- Remove the incorrect policy - public profile data is accessed via generated static pages, not direct table queries
DROP POLICY IF EXISTS "Users can view public enrollments of public profiles in shared programs" ON public.client_enrollments;

-- Also drop the helper function since it's no longer needed
DROP FUNCTION IF EXISTS public.is_program_participant(uuid, uuid);