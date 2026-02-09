-- Create storage policies for external-course-certificates bucket
CREATE POLICY "Users can upload their own certificates"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'external-course-certificates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own certificates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'external-course-certificates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own certificates"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'external-course-certificates' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all certificates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'external-course-certificates' AND
  has_role(auth.uid(), 'admin'::app_role)
);