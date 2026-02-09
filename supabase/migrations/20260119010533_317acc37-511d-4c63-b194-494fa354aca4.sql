-- Make the task-note-resources bucket private
UPDATE storage.buckets SET public = false WHERE id = 'task-note-resources';

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view task note resource files" ON storage.objects;

-- Create a restrictive SELECT policy - users can only view their own files
CREATE POLICY "Users can view their own task note resource files"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-note-resources' AND auth.uid()::text = (storage.foldername(name))[1]);