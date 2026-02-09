-- Create client_staff_notes table for private staff journaling about clients
CREATE TABLE public.client_staff_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL,
  author_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  note_type TEXT NOT NULL DEFAULT 'general',
  sentiment TEXT,
  tags TEXT[],
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attachments table for notes (files and links)
CREATE TABLE public.client_staff_note_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.client_staff_notes(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL DEFAULT 'link',
  title TEXT NOT NULL,
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff_note_attachments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_client_staff_notes_client ON public.client_staff_notes(client_user_id);
CREATE INDEX idx_client_staff_notes_author ON public.client_staff_notes(author_id);
CREATE INDEX idx_client_staff_notes_enrollment ON public.client_staff_notes(enrollment_id);
CREATE INDEX idx_client_staff_note_attachments_note ON public.client_staff_note_attachments(note_id);

-- RLS Policies for client_staff_notes
-- Admins can see all notes
CREATE POLICY "Admins can view all client staff notes"
ON public.client_staff_notes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Instructors/Coaches can only see their own notes
CREATE POLICY "Staff can view their own client notes"
ON public.client_staff_notes
FOR SELECT
USING (auth.uid() = author_id);

-- Admins can insert notes
CREATE POLICY "Admins can insert client staff notes"
ON public.client_staff_notes
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff can insert their own notes
CREATE POLICY "Staff can insert their own client notes"
ON public.client_staff_notes
FOR INSERT
WITH CHECK (auth.uid() = author_id);

-- Admins can update any note
CREATE POLICY "Admins can update any client staff note"
ON public.client_staff_notes
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Staff can update their own notes
CREATE POLICY "Staff can update their own client notes"
ON public.client_staff_notes
FOR UPDATE
USING (auth.uid() = author_id);

-- Admins can delete any note
CREATE POLICY "Admins can delete any client staff note"
ON public.client_staff_notes
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Staff can delete their own notes
CREATE POLICY "Staff can delete their own client notes"
ON public.client_staff_notes
FOR DELETE
USING (auth.uid() = author_id);

-- RLS Policies for attachments (inherit from parent note access)
CREATE POLICY "Users can view attachments for accessible notes"
ON public.client_staff_note_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = note_id
    AND (public.has_role(auth.uid(), 'admin') OR n.author_id = auth.uid())
  )
);

CREATE POLICY "Users can insert attachments for their notes"
ON public.client_staff_note_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = note_id
    AND (public.has_role(auth.uid(), 'admin') OR n.author_id = auth.uid())
  )
);

CREATE POLICY "Users can delete attachments for their notes"
ON public.client_staff_note_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.client_staff_notes n
    WHERE n.id = note_id
    AND (public.has_role(auth.uid(), 'admin') OR n.author_id = auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_client_staff_notes_updated_at
BEFORE UPDATE ON public.client_staff_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.client_staff_notes IS 'Private staff notes/journal entries about clients. Admins see all, staff see only their own.';