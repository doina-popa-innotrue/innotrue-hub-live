-- Create junction table for development items linked to goals
CREATE TABLE public.development_item_goal_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, goal_id)
);

-- Create junction table for development items linked to milestones
CREATE TABLE public.development_item_milestone_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.goal_milestones(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, milestone_id)
);

-- Enable RLS
ALTER TABLE public.development_item_goal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_milestone_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for goal links
CREATE POLICY "Users can view their own goal links"
ON public.development_item_goal_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own goal links"
ON public.development_item_goal_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own goal links"
ON public.development_item_goal_links FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

-- RLS policies for milestone links
CREATE POLICY "Users can view their own milestone links"
ON public.development_item_milestone_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own milestone links"
ON public.development_item_milestone_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own milestone links"
ON public.development_item_milestone_links FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);