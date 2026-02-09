
-- Resource Collections table
CREATE TABLE public.resource_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction table for resources in collections
CREATE TABLE public.resource_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.resource_collections(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collection_id, resource_id)
);

-- Domain to Collection links
CREATE TABLE public.domain_collection_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.resource_collections(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain_id, collection_id)
);

-- Question to Collection links
CREATE TABLE public.question_collection_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.resource_collections(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, collection_id)
);

-- Enable RLS
ALTER TABLE public.resource_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_collection_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_collection_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resource_collections
CREATE POLICY "Admins can manage resource collections"
  ON public.resource_collections FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active collections"
  ON public.resource_collections FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- RLS Policies for resource_collection_items
CREATE POLICY "Admins can manage collection items"
  ON public.resource_collection_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view collection items"
  ON public.resource_collection_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for domain_collection_links
CREATE POLICY "Admins can manage domain collection links"
  ON public.domain_collection_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view domain collection links"
  ON public.domain_collection_links FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for question_collection_links
CREATE POLICY "Admins can manage question collection links"
  ON public.question_collection_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view question collection links"
  ON public.question_collection_links FOR SELECT
  USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX idx_resource_collection_items_collection ON public.resource_collection_items(collection_id);
CREATE INDEX idx_resource_collection_items_resource ON public.resource_collection_items(resource_id);
CREATE INDEX idx_domain_collection_links_domain ON public.domain_collection_links(domain_id);
CREATE INDEX idx_domain_collection_links_collection ON public.domain_collection_links(collection_id);
CREATE INDEX idx_question_collection_links_question ON public.question_collection_links(question_id);
CREATE INDEX idx_question_collection_links_collection ON public.question_collection_links(collection_id);

-- Trigger for updated_at
CREATE TRIGGER update_resource_collections_updated_at
  BEFORE UPDATE ON public.resource_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
