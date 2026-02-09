-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_group_member_directory(uuid);

-- Now create with new signature including scheduling_url
CREATE FUNCTION public.get_group_member_directory(_group_id uuid)
RETURNS TABLE(
  user_id uuid, 
  role group_member_role, 
  joined_at timestamp with time zone, 
  name text, 
  avatar_url text, 
  email text, 
  timezone text, 
  preferred_meeting_times jsonb,
  scheduling_url text
)
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
    p.preferred_meeting_times,
    p.scheduling_url
  FROM public.group_memberships gm
  JOIN public.profiles p ON p.id = gm.user_id
  JOIN auth.users au ON au.id = gm.user_id
  WHERE gm.group_id = _group_id
    AND gm.status = 'active'
  ORDER BY
    CASE gm.role
      WHEN 'leader' THEN 1
      WHEN 'member' THEN 2
    END,
    gm.joined_at;
$function$;