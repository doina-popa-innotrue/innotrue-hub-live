-- =====================================================
-- REFLECTION CONSOLIDATION + AI PROMPT GENERATION SYSTEM
-- =====================================================

-- 1. Add module_progress link table for development_items
CREATE TABLE IF NOT EXISTS public.development_item_module_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  module_progress_id UUID NOT NULL REFERENCES public.module_progress(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, module_progress_id)
);

-- Enable RLS
ALTER TABLE public.development_item_module_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for module links (through development_items ownership)
CREATE POLICY "Users can view their own module links" 
ON public.development_item_module_links 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di 
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own module links" 
ON public.development_item_module_links 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.development_items di 
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own module links" 
ON public.development_item_module_links 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.development_items di 
    WHERE di.id = development_item_id AND di.user_id = auth.uid()
  )
);

-- 2. Create the generated_prompts table for AI-generated weekly/monthly prompts
CREATE TABLE IF NOT EXISTS public.generated_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_context JSONB DEFAULT '{}'::jsonb,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'on_demand')),
  period_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped', 'expired')),
  response_item_id UUID REFERENCES public.development_items(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  skipped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_prompts ENABLE ROW LEVEL SECURITY;

-- RLS policies for generated_prompts
CREATE POLICY "Users can view their own prompts" 
ON public.generated_prompts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts" 
ON public.generated_prompts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own prompts" 
ON public.generated_prompts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Now add the prompt_id column to development_items
ALTER TABLE public.development_items 
ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.generated_prompts(id) ON DELETE SET NULL;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_prompts_user_id ON public.generated_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_prompts_status ON public.generated_prompts(status);
CREATE INDEX IF NOT EXISTS idx_generated_prompts_period ON public.generated_prompts(user_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_development_items_prompt_id ON public.development_items(prompt_id);
CREATE INDEX IF NOT EXISTS idx_development_item_module_links_item ON public.development_item_module_links(development_item_id);
CREATE INDEX IF NOT EXISTS idx_development_item_module_links_module ON public.development_item_module_links(module_progress_id);

-- 5. Create trigger for updated_at on generated_prompts
CREATE TRIGGER update_generated_prompts_updated_at
BEFORE UPDATE ON public.generated_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Migrate existing goal_reflections to development_items
INSERT INTO public.development_items (id, user_id, item_type, content, created_at, updated_at)
SELECT 
  id,
  user_id,
  'reflection',
  content,
  created_at,
  updated_at
FROM public.goal_reflections
ON CONFLICT (id) DO NOTHING;

-- Create the goal links for migrated reflections
INSERT INTO public.development_item_goal_links (development_item_id, goal_id, created_at)
SELECT 
  id,
  goal_id,
  created_at
FROM public.goal_reflections
ON CONFLICT DO NOTHING;

-- 7. Migrate existing module_reflections to development_items
INSERT INTO public.development_items (id, user_id, item_type, content, created_at, updated_at)
SELECT 
  id,
  user_id,
  'reflection',
  content,
  created_at,
  updated_at
FROM public.module_reflections
ON CONFLICT (id) DO NOTHING;

-- Create the module links for migrated reflections
INSERT INTO public.development_item_module_links (development_item_id, module_progress_id, created_at)
SELECT 
  id,
  module_progress_id,
  created_at
FROM public.module_reflections
ON CONFLICT DO NOTHING;