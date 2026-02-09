-- Create email template assets table for preset images
CREATE TABLE public.email_template_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  is_system_logo BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_template_assets ENABLE ROW LEVEL SECURITY;

-- Only admins can manage assets using existing has_role function
CREATE POLICY "Admins can manage email template assets"
ON public.email_template_assets
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_email_template_assets_updated_at
BEFORE UPDATE ON public.email_template_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for email assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for email assets bucket
CREATE POLICY "Public can view email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins can upload email assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-assets' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update email assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'email-assets' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete email assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'email-assets' 
  AND public.has_role(auth.uid(), 'admin')
);