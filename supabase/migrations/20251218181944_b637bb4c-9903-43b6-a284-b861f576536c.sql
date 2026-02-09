-- External sources configuration (e.g., TalentLMS, Coursera, etc.)
CREATE TABLE public.external_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., 'talentlms', 'coursera'
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- store API configuration, endpoints, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mapping between modules and external content
CREATE TABLE public.module_external_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES program_modules(id) ON DELETE CASCADE,
  external_source_id UUID NOT NULL REFERENCES external_sources(id) ON DELETE CASCADE,
  external_content_id TEXT NOT NULL, -- The ID in the external system
  external_content_name TEXT, -- Optional name for display
  sync_completion BOOLEAN DEFAULT true, -- Whether to sync completion status
  sync_progress BOOLEAN DEFAULT true, -- Whether to sync progress percentage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module_id, external_source_id) -- One mapping per source per module
);

-- Generic external progress tracking
CREATE TABLE public.external_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_external_mapping_id UUID NOT NULL REFERENCES module_external_mappings(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0,
  completion_status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed
  external_score NUMERIC,
  completed_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  external_metadata JSONB DEFAULT '{}', -- Store source-specific data (time spent, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module_external_mapping_id)
);

-- Enable RLS
ALTER TABLE public.external_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_progress ENABLE ROW LEVEL SECURITY;

-- RLS for external_sources (admins manage, all authenticated can view active)
CREATE POLICY "Admins can manage external sources"
  ON public.external_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active external sources"
  ON public.external_sources FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS for module_external_mappings (admins manage, users can view for accessible modules)
CREATE POLICY "Admins can manage module external mappings"
  ON public.module_external_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view mappings for accessible modules"
  ON public.module_external_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM program_modules pm
      JOIN programs p ON p.id = pm.program_id
      WHERE pm.id = module_external_mappings.module_id
      AND (p.is_active = true OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS for external_progress
CREATE POLICY "Admins can manage all external progress"
  ON public.external_progress FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own external progress"
  ON public.external_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own external progress"
  ON public.external_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_module_external_mappings_module ON public.module_external_mappings(module_id);
CREATE INDEX idx_module_external_mappings_source ON public.module_external_mappings(external_source_id);
CREATE INDEX idx_external_progress_user ON public.external_progress(user_id);
CREATE INDEX idx_external_progress_mapping ON public.external_progress(module_external_mapping_id);

-- Seed TalentLMS as the first external source
INSERT INTO public.external_sources (name, display_name, is_active, config)
VALUES ('talentlms', 'TalentLMS', true, '{"api_version": "v1"}');