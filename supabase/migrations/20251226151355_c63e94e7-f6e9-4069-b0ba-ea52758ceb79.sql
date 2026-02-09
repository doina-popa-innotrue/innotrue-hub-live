-- Create a secure directory function so group members can see each other (name/avatar/email)
CREATE OR REPLACE FUNCTION public.get_group_member_directory(_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  role public.group_member_role,
  joined_at timestamptz,
  name text,
  avatar_url text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    gm.user_id,
    gm.role,
    gm.joined_at,
    p.name,
    p.avatar_url,
    au.email
  FROM public.group_memberships gm
  JOIN public.profiles p ON p.id = gm.user_id
  JOIN auth.users au ON au.id = gm.user_id
  WHERE gm.group_id = _group_id
    AND gm.status = 'active'
    AND (
      public.is_group_member(auth.uid(), _group_id)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$$;