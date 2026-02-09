-- Create storage bucket for program logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-logos', 'program-logos', true);

-- Allow public access to view program logos
CREATE POLICY "Anyone can view program logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-logos');

-- Allow admins to upload program logos
CREATE POLICY "Admins can upload program logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'program-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update program logos
CREATE POLICY "Admins can update program logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'program-logos' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete program logos
CREATE POLICY "Admins can delete program logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'program-logos' AND has_role(auth.uid(), 'admin'::app_role));