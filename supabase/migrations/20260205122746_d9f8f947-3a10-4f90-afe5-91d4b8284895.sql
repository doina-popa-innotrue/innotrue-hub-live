
-- Secure helper to check whether a module_type has an active Cal.com mapping
-- Avoids granting broad SELECT access to calcom_event_type_mappings.

CREATE OR REPLACE FUNCTION public.module_type_has_session_capability(_module_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calcom_event_type_mappings m
    WHERE m.module_type = _module_type
      AND COALESCE(m.is_active, false) = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.module_type_has_session_capability(text) TO authenticated;
