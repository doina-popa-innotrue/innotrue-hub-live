-- Create decision_comments table with proper FK
CREATE TABLE public.decision_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.decisions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('client', 'coach', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create task_comments table with proper FK
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('client', 'coach', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.decision_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS for decision_comments
CREATE POLICY "Users can view comments on their decisions"
  ON public.decision_comments FOR SELECT
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.decisions d
      WHERE d.id = decision_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.decisions d
      JOIN public.client_coaches cc ON cc.client_id = d.user_id
      WHERE d.id = decision_id AND cc.coach_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'instructor', 'coach')
    )
  );

CREATE POLICY "Users can create comments on accessible decisions"
  ON public.decision_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.decisions d
        WHERE d.id = decision_id AND d.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.decisions d
        JOIN public.client_coaches cc ON cc.client_id = d.user_id
        WHERE d.id = decision_id AND cc.coach_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'instructor', 'coach')
      )
    )
  );

CREATE POLICY "Users can delete own comments"
  ON public.decision_comments FOR DELETE
  USING (author_id = auth.uid());

-- RLS for task_comments
CREATE POLICY "Users can view comments on their tasks"
  ON public.task_comments FOR SELECT
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.client_coaches cc ON cc.client_id = t.user_id
      WHERE t.id = task_id AND cc.coach_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'instructor', 'coach')
    )
  );

CREATE POLICY "Users can create comments on accessible tasks"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_id AND t.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.client_coaches cc ON cc.client_id = t.user_id
        WHERE t.id = task_id AND cc.coach_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'instructor', 'coach')
      )
    )
  );

CREATE POLICY "Users can delete own task comments"
  ON public.task_comments FOR DELETE
  USING (author_id = auth.uid());

-- Migrate existing data from comments table
INSERT INTO public.decision_comments (id, decision_id, author_id, author_role, body, created_at)
SELECT id, item_id::uuid, author_id, author_role::text, body, created_at
FROM public.comments
WHERE item_type = 'decision';

INSERT INTO public.task_comments (id, task_id, author_id, author_role, body, created_at)
SELECT id, item_id::uuid, author_id, author_role::text, body, created_at
FROM public.comments
WHERE item_type = 'task';

-- Drop old comments table
DROP TABLE public.comments;

-- Drop the enums (no longer needed)
DROP TYPE public.comment_item_type;
DROP TYPE public.comment_author_role;

-- Create indexes for performance
CREATE INDEX idx_decision_comments_decision_id ON public.decision_comments(decision_id);
CREATE INDEX idx_decision_comments_author_id ON public.decision_comments(author_id);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_author_id ON public.task_comments(author_id);