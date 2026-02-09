
-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_group_member_directory(uuid);

CREATE FUNCTION public.get_group_member_directory(_group_id uuid)
 RETURNS TABLE(user_id uuid, role group_member_role, joined_at timestamp with time zone, name text, avatar_url text, email text, timezone text, preferred_meeting_times jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    gm.user_id,
    gm.role,
    gm.joined_at,
    p.name,
    p.avatar_url,
    au.email,
    p.timezone,
    p.preferred_meeting_times
  FROM public.group_memberships gm
  JOIN public.profiles p ON p.id = gm.user_id
  JOIN auth.users au ON au.id = gm.user_id
  WHERE gm.group_id = _group_id
    AND gm.status = 'active'
    AND (
      public.is_group_member(auth.uid(), _group_id)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$function$;
