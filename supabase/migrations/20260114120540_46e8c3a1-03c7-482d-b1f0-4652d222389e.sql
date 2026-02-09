-- Create task_notes table for multiple notes per task
CREATE TABLE public.task_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_note_resources table for attachments/links on notes
CREATE TABLE public.task_note_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.task_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'link',
  url TEXT,
  file_path TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on task_notes
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for task_notes
CREATE POLICY "Users can view their own task notes"
ON public.task_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own task notes"
ON public.task_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task notes"
ON public.task_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task notes"
ON public.task_notes FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on task_note_resources
ALTER TABLE public.task_note_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for task_note_resources
CREATE POLICY "Users can view their own task note resources"
ON public.task_note_resources FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own task note resources"
ON public.task_note_resources FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task note resources"
ON public.task_note_resources FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task note resources"
ON public.task_note_resources FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for task note resources
INSERT INTO storage.buckets (id, name, public) VALUES ('task-note-resources', 'task-note-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-note-resources bucket
CREATE POLICY "Users can view task note resource files"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-note-resources');

CREATE POLICY "Users can upload task note resource files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-note-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their task note resource files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-note-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their task note resource files"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-note-resources' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at on task_notes
CREATE TRIGGER update_task_notes_updated_at
BEFORE UPDATE ON public.task_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();