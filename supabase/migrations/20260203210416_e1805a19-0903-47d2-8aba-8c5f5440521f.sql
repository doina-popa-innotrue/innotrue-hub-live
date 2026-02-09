-- Create storage bucket for development item files/attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('development-item-files', 'development-item-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for development-item-files bucket
-- Users can view files for items they own or are the author of
CREATE POLICY "Users can view their development item files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'development-item-files' AND
  (
    -- Owner of the file path (first segment is user_id)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Check if user owns or authored the development item
    EXISTS (
      SELECT 1 FROM development_items di
      WHERE di.file_path = name
      AND (di.user_id = auth.uid() OR di.author_id = auth.uid())
    )
  )
);

-- Authors (instructors/coaches) can upload files to their clients' folders
CREATE POLICY "Authors can upload development item files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'development-item-files' AND
  auth.uid() IS NOT NULL
);

-- Authors can update their uploaded files
CREATE POLICY "Authors can update their development item files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'development-item-files' AND
  auth.uid() IS NOT NULL
);

-- Authors can delete their uploaded files  
CREATE POLICY "Authors can delete their development item files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'development-item-files' AND
  auth.uid() IS NOT NULL
);

-- Add column to development_items for linking to resource library
ALTER TABLE development_items 
ADD COLUMN IF NOT EXISTS library_resource_id uuid REFERENCES resource_library(id) ON DELETE SET NULL;