-- Create junction table for development items linked to capability questions
CREATE TABLE public.development_item_question_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.capability_snapshots(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, question_id)
);

-- Create junction table for development items linked to capability domains
CREATE TABLE public.development_item_domain_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.capability_snapshots(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, domain_id)
);

-- Create junction table for development items linked to capability snapshots (general link)
CREATE TABLE public.development_item_snapshot_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES public.capability_snapshots(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, snapshot_id)
);

-- Enable RLS on all junction tables
ALTER TABLE public.development_item_question_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_domain_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_snapshot_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for question links (user owns the development item)
CREATE POLICY "Users can view their own question links"
  ON public.development_item_question_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own question links"
  ON public.development_item_question_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own question links"
  ON public.development_item_question_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

-- RLS policies for domain links
CREATE POLICY "Users can view their own domain links"
  ON public.development_item_domain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own domain links"
  ON public.development_item_domain_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own domain links"
  ON public.development_item_domain_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

-- RLS policies for snapshot links
CREATE POLICY "Users can view their own snapshot links"
  ON public.development_item_snapshot_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own snapshot links"
  ON public.development_item_snapshot_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own snapshot links"
  ON public.development_item_snapshot_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

-- Coach access policies for question links
CREATE POLICY "Coaches can view client question links"
  ON public.development_item_question_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      JOIN public.client_coaches cc ON cc.client_id = di.user_id
      WHERE di.id = development_item_id AND cc.coach_id = auth.uid()
    )
  );

-- Coach access policies for domain links
CREATE POLICY "Coaches can view client domain links"
  ON public.development_item_domain_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      JOIN public.client_coaches cc ON cc.client_id = di.user_id
      WHERE di.id = development_item_id AND cc.coach_id = auth.uid()
    )
  );

-- Coach access policies for snapshot links
CREATE POLICY "Coaches can view client snapshot links"
  ON public.development_item_snapshot_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      JOIN public.client_coaches cc ON cc.client_id = di.user_id
      WHERE di.id = development_item_id AND cc.coach_id = auth.uid()
    )
  );

-- Migrate existing data from polymorphic table to junction tables
-- Question/rating links
INSERT INTO public.development_item_question_links (development_item_id, question_id, snapshot_id, created_at)
SELECT 
  dil.development_item_id,
  dil.linked_id::uuid,
  dil.snapshot_id,
  dil.created_at
FROM public.development_item_links dil
WHERE dil.linked_type = 'capability_rating'
  AND dil.linked_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.capability_domain_questions q WHERE q.id = dil.linked_id::uuid)
ON CONFLICT DO NOTHING;

-- Domain links
INSERT INTO public.development_item_domain_links (development_item_id, domain_id, snapshot_id, created_at)
SELECT 
  dil.development_item_id,
  dil.linked_id::uuid,
  dil.snapshot_id,
  dil.created_at
FROM public.development_item_links dil
WHERE dil.linked_type = 'domain'
  AND dil.linked_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.capability_domains d WHERE d.id = dil.linked_id::uuid)
ON CONFLICT DO NOTHING;

-- Snapshot links (general)
INSERT INTO public.development_item_snapshot_links (development_item_id, snapshot_id, created_at)
SELECT 
  dil.development_item_id,
  dil.snapshot_id,
  dil.created_at
FROM public.development_item_links dil
WHERE dil.linked_type = 'snapshot'
  AND dil.snapshot_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.capability_snapshots s WHERE s.id = dil.snapshot_id)
ON CONFLICT DO NOTHING;

-- Drop old polymorphic table
DROP TABLE public.development_item_links;

-- Add indexes for common queries
CREATE INDEX idx_dev_item_question_links_question ON public.development_item_question_links(question_id);
CREATE INDEX idx_dev_item_question_links_item ON public.development_item_question_links(development_item_id);
CREATE INDEX idx_dev_item_domain_links_domain ON public.development_item_domain_links(domain_id);
CREATE INDEX idx_dev_item_domain_links_item ON public.development_item_domain_links(development_item_id);
CREATE INDEX idx_dev_item_snapshot_links_snapshot ON public.development_item_snapshot_links(snapshot_id);
CREATE INDEX idx_dev_item_snapshot_links_item ON public.development_item_snapshot_links(development_item_id);