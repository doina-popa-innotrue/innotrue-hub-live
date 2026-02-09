-- Create storage bucket for goal resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('goal-resources', 'goal-resources', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for goal-resources bucket
CREATE POLICY "Users can view their own goal resources"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'goal-resources' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own goal resources"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'goal-resources' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own goal resources"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'goal-resources' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own goal resources"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'goal-resources' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all goal resources"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'goal-resources' AND
  has_role(auth.uid(), 'admin')
);