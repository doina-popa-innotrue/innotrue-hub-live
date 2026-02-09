
-- =====================================================
-- DEVELOPMENT ITEMS SYSTEM (Shared across features)
-- =====================================================

-- Development items - central table for reflections, resources, action items
CREATE TABLE public.development_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('reflection', 'resource', 'action_item')),
  title TEXT,
  content TEXT,
  -- Resource-specific fields
  resource_type TEXT CHECK (resource_type IN ('link', 'file', 'image') OR resource_type IS NULL),
  resource_url TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  -- Action item fields
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled') OR status IS NULL),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Development item links - polymorphic junction for linking items to features
CREATE TABLE public.development_item_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_item_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  linked_type TEXT NOT NULL,
  linked_id UUID NOT NULL,
  snapshot_id UUID,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(development_item_id, linked_type, linked_id)
);

-- =====================================================
-- CAPABILITY ASSESSMENTS SYSTEM
-- =====================================================

-- Capability assessments - admin-created assessment definitions
CREATE TABLE public.capability_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  instructions TEXT,
  feature_key TEXT,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  allow_instructor_eval BOOLEAN NOT NULL DEFAULT true,
  rating_scale INTEGER NOT NULL DEFAULT 10 CHECK (rating_scale IN (5, 10)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Capability domains - sections within an assessment
CREATE TABLE public.capability_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Capability domain questions - questions within a domain
CREATE TABLE public.capability_domain_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Capability snapshots - point-in-time user assessments
CREATE TABLE public.capability_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  title TEXT,
  notes TEXT,
  shared_with_coach BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Capability snapshot ratings - individual question ratings within a snapshot
CREATE TABLE public.capability_snapshot_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.capability_snapshots(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, question_id)
);

-- Capability domain notes - domain-level notes within a snapshot
CREATE TABLE public.capability_domain_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.capability_snapshots(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, domain_id)
);

-- =====================================================
-- INSTRUCTOR EVALUATIONS
-- =====================================================

-- Instructor capability evaluations - coach evaluation of a client snapshot
CREATE TABLE public.instructor_capability_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES public.capability_snapshots(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL,
  overall_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id, instructor_id)
);

-- Instructor capability ratings - question-level instructor ratings
CREATE TABLE public.instructor_capability_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.instructor_capability_evaluations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, question_id)
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.development_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_domain_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_snapshot_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_domain_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_capability_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_capability_ratings ENABLE ROW LEVEL SECURITY;

-- Development items policies
CREATE POLICY "Users can manage their own development items"
  ON public.development_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can view shared client development items"
  ON public.development_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.coach_id = auth.uid() AND cc.client_id = development_items.user_id
    )
  );

-- Development item links policies
CREATE POLICY "Users can manage their own development item links"
  ON public.development_item_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.development_items di
      WHERE di.id = development_item_id AND di.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view shared client development item links"
  ON public.development_item_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.development_items di
      JOIN public.client_coaches cc ON cc.client_id = di.user_id
      WHERE di.id = development_item_id AND cc.coach_id = auth.uid()
    )
  );

-- Capability assessments policies
CREATE POLICY "Anyone can view active assessments"
  ON public.capability_assessments FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage assessments"
  ON public.capability_assessments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Capability domains policies
CREATE POLICY "Anyone can view domains of active assessments"
  ON public.capability_domains FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_assessments ca
      WHERE ca.id = assessment_id AND ca.is_active = true
    )
  );

CREATE POLICY "Admins can manage domains"
  ON public.capability_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Capability domain questions policies
CREATE POLICY "Anyone can view questions of active assessments"
  ON public.capability_domain_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_domains cd
      JOIN public.capability_assessments ca ON ca.id = cd.assessment_id
      WHERE cd.id = domain_id AND ca.is_active = true
    )
  );

CREATE POLICY "Admins can manage questions"
  ON public.capability_domain_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Capability snapshots policies
CREATE POLICY "Users can manage their own snapshots"
  ON public.capability_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can view shared client snapshots"
  ON public.capability_snapshots FOR SELECT
  USING (
    shared_with_coach = true AND
    EXISTS (
      SELECT 1 FROM public.client_coaches cc
      WHERE cc.coach_id = auth.uid() AND cc.client_id = capability_snapshots.user_id
    )
  );

CREATE POLICY "Admins can view all snapshots"
  ON public.capability_snapshots FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Capability snapshot ratings policies
CREATE POLICY "Users can manage their own snapshot ratings"
  ON public.capability_snapshot_ratings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = snapshot_id AND cs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = snapshot_id AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view shared client snapshot ratings"
  ON public.capability_snapshot_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      JOIN public.client_coaches cc ON cc.client_id = cs.user_id
      WHERE cs.id = snapshot_id AND cs.shared_with_coach = true AND cc.coach_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all snapshot ratings"
  ON public.capability_snapshot_ratings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Capability domain notes policies
CREATE POLICY "Users can manage their own domain notes"
  ON public.capability_domain_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = snapshot_id AND cs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = snapshot_id AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can view shared client domain notes"
  ON public.capability_domain_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      JOIN public.client_coaches cc ON cc.client_id = cs.user_id
      WHERE cs.id = snapshot_id AND cs.shared_with_coach = true AND cc.coach_id = auth.uid()
    )
  );

-- Instructor evaluations policies
CREATE POLICY "Instructors can manage their own evaluations"
  ON public.instructor_capability_evaluations FOR ALL
  USING (auth.uid() = instructor_id)
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Users can view evaluations of their snapshots"
  ON public.instructor_capability_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capability_snapshots cs
      WHERE cs.id = snapshot_id AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all evaluations"
  ON public.instructor_capability_evaluations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Instructor capability ratings policies
CREATE POLICY "Instructors can manage their own ratings"
  ON public.instructor_capability_ratings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_capability_evaluations ice
      WHERE ice.id = evaluation_id AND ice.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructor_capability_evaluations ice
      WHERE ice.id = evaluation_id AND ice.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Users can view instructor ratings on their snapshots"
  ON public.instructor_capability_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instructor_capability_evaluations ice
      JOIN public.capability_snapshots cs ON cs.id = ice.snapshot_id
      WHERE ice.id = evaluation_id AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all instructor ratings"
  ON public.instructor_capability_ratings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_development_items_user ON public.development_items(user_id);
CREATE INDEX idx_development_items_type ON public.development_items(item_type);
CREATE INDEX idx_development_item_links_item ON public.development_item_links(development_item_id);
CREATE INDEX idx_development_item_links_linked ON public.development_item_links(linked_type, linked_id);
CREATE INDEX idx_development_item_links_snapshot ON public.development_item_links(snapshot_id) WHERE snapshot_id IS NOT NULL;

CREATE INDEX idx_capability_domains_assessment ON public.capability_domains(assessment_id);
CREATE INDEX idx_capability_domain_questions_domain ON public.capability_domain_questions(domain_id);
CREATE INDEX idx_capability_snapshots_user ON public.capability_snapshots(user_id);
CREATE INDEX idx_capability_snapshots_assessment ON public.capability_snapshots(assessment_id);
CREATE INDEX idx_capability_snapshot_ratings_snapshot ON public.capability_snapshot_ratings(snapshot_id);
CREATE INDEX idx_capability_domain_notes_snapshot ON public.capability_domain_notes(snapshot_id);
CREATE INDEX idx_instructor_capability_evaluations_snapshot ON public.instructor_capability_evaluations(snapshot_id);
CREATE INDEX idx_instructor_capability_ratings_evaluation ON public.instructor_capability_ratings(evaluation_id);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE TRIGGER update_development_items_updated_at
  BEFORE UPDATE ON public.development_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_assessments_updated_at
  BEFORE UPDATE ON public.capability_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_snapshots_updated_at
  BEFORE UPDATE ON public.capability_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_snapshot_ratings_updated_at
  BEFORE UPDATE ON public.capability_snapshot_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capability_domain_notes_updated_at
  BEFORE UPDATE ON public.capability_domain_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instructor_capability_evaluations_updated_at
  BEFORE UPDATE ON public.instructor_capability_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instructor_capability_ratings_updated_at
  BEFORE UPDATE ON public.instructor_capability_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
