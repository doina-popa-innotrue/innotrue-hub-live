
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users with explicit share can view assessment files" ON storage.objects;

-- Create a security definer function to check assessment file access without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.check_assessment_file_share_access(file_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_assessments ua
    JOIN user_assessment_shares uas ON uas.user_assessment_id = ua.id
    WHERE ua.file_path = file_name 
    AND uas.shared_with_user_id = auth.uid()
  );
END;
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Users with explicit share can view assessment files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'psychometric-assessments'
  AND public.check_assessment_file_share_access(name)
);
