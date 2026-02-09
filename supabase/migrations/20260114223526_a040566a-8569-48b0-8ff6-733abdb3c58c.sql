-- First, drop the existing check constraint and recreate with 'note' included
ALTER TABLE public.development_items DROP CONSTRAINT IF EXISTS development_items_item_type_check;
ALTER TABLE public.development_items ADD CONSTRAINT development_items_item_type_check 
  CHECK (item_type IN ('reflection', 'resource', 'action_item', 'note'));

-- Create development_item_task_links table (if not exists from partial migration)
CREATE TABLE IF NOT EXISTS public.development_item_task_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, task_id)
);

-- Create development_item_group_links table (if not exists from partial migration)
CREATE TABLE IF NOT EXISTS public.development_item_group_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, group_id)
);

-- Enable RLS (idempotent)
ALTER TABLE public.development_item_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_group_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for task links (drop first if exist)
DROP POLICY IF EXISTS "Users can view own task links" ON public.development_item_task_links;
DROP POLICY IF EXISTS "Users can create own task links" ON public.development_item_task_links;
DROP POLICY IF EXISTS "Users can delete own task links" ON public.development_item_task_links;

CREATE POLICY "Users can view own task links"
  ON public.development_item_task_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own task links"
  ON public.development_item_task_links FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own task links"
  ON public.development_item_task_links FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

-- RLS policies for group links (drop first if exist)
DROP POLICY IF EXISTS "Users can view own group links" ON public.development_item_group_links;
DROP POLICY IF EXISTS "Users can create own group links" ON public.development_item_group_links;
DROP POLICY IF EXISTS "Users can delete own group links" ON public.development_item_group_links;

CREATE POLICY "Users can view own group links"
  ON public.development_item_group_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

CREATE POLICY "Users can create own group links"
  ON public.development_item_group_links FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own group links"
  ON public.development_item_group_links FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.development_items di WHERE di.id = development_item_id AND di.user_id = auth.uid()
  ));

-- Add indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_dev_item_task_links_task ON public.development_item_task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_dev_item_task_links_item ON public.development_item_task_links(development_item_id);
CREATE INDEX IF NOT EXISTS idx_dev_item_group_links_group ON public.development_item_group_links(group_id);
CREATE INDEX IF NOT EXISTS idx_dev_item_group_links_item ON public.development_item_group_links(development_item_id);

-- Migrate task_notes to development_items
INSERT INTO public.development_items (id, user_id, item_type, title, content, created_at, updated_at)
SELECT 
  id,
  user_id,
  'note',
  title,
  content,
  created_at,
  updated_at
FROM public.task_notes
ON CONFLICT (id) DO NOTHING;

-- Create task links for migrated notes
INSERT INTO public.development_item_task_links (development_item_id, task_id)
SELECT id, task_id FROM public.task_notes
ON CONFLICT (development_item_id, task_id) DO NOTHING;

-- Migrate task_note_resources to development_items as resources
INSERT INTO public.development_items (id, user_id, item_type, title, content, resource_url, created_at, updated_at)
SELECT 
  tnr.id,
  tnr.user_id,
  'resource',
  tnr.title,
  tnr.description,
  COALESCE(tnr.url, tnr.file_path),
  tnr.created_at,
  tnr.created_at
FROM public.task_note_resources tnr
ON CONFLICT (id) DO NOTHING;

-- Link task note resources to their parent task
INSERT INTO public.development_item_task_links (development_item_id, task_id)
SELECT tnr.id, tn.task_id 
FROM public.task_note_resources tnr
JOIN public.task_notes tn ON tn.id = tnr.note_id
ON CONFLICT (development_item_id, task_id) DO NOTHING;

-- Migrate group_notes to development_items
INSERT INTO public.development_items (id, user_id, item_type, title, content, created_at, updated_at)
SELECT 
  id,
  created_by,
  'note',
  title,
  content,
  created_at,
  updated_at
FROM public.group_notes
ON CONFLICT (id) DO NOTHING;

-- Create group links for migrated notes
INSERT INTO public.development_item_group_links (development_item_id, group_id)
SELECT id, group_id FROM public.group_notes
ON CONFLICT (development_item_id, group_id) DO NOTHING;