-- Create storage bucket for client badges
INSERT INTO storage.buckets (id, name, public) VALUES ('client-badges', 'client-badges', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for client-badges bucket
CREATE POLICY "Users can view their own badge images"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-badges' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can manage all client badge images"
ON storage.objects FOR ALL
USING (bucket_id = 'client-badges' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can upload client badge images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-badges' AND has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Public can view public badge images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-badges' AND
  EXISTS (
    SELECT 1 FROM client_badges cb
    JOIN public_profile_settings pps ON pps.user_id = cb.user_id
    WHERE cb.is_public = true 
    AND pps.is_public = true
    AND cb.image_path = name
  )
);