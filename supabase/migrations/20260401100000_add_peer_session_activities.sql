-- Peer Session Presentations: allow group members to present scenario solutions
-- and have peers assess them, directly from group session detail pages.

-- =============================================================================
-- 1. SECURITY DEFINER helper: check if current user is an active group member
--    for the group that owns a given session
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_session_group_member(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_sessions gs
    JOIN public.group_memberships gm ON gm.group_id = gs.group_id
    WHERE gs.id = p_session_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  );
$$;

-- =============================================================================
-- 2. Table: group_session_activities
-- =============================================================================
CREATE TABLE public.group_session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  topic_description TEXT,
  scenario_template_id UUID REFERENCES public.scenario_templates(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES public.resource_library(id) ON DELETE SET NULL,
  resource_url TEXT,
  assignment_type_id UUID REFERENCES public.module_assignment_types(id) ON DELETE SET NULL,
  capability_assessment_id UUID REFERENCES public.capability_assessments(id) ON DELETE SET NULL,
  presenter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assessor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responses JSONB,
  overall_comments TEXT,
  submitted_at TIMESTAMPTZ,
  scoring_snapshot_id UUID REFERENCES public.capability_snapshots(id) ON DELETE SET NULL,
  evaluator_notes TEXT,
  evaluated_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'presenter_assigned', 'submitted', 'assessor_assigned', 'evaluated')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_group_session_activities
  BEFORE UPDATE ON public.group_session_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for session lookup (UNIQUE already creates an index on session_id)

-- =============================================================================
-- 3. Table: group_session_activity_attachments
-- =============================================================================
CREATE TABLE public.group_session_activity_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.group_session_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('link', 'file', 'image')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_attachments_activity_id ON public.group_session_activity_attachments(activity_id);

-- =============================================================================
-- 4. Storage bucket for file/image attachments
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('peer-presentation-attachments', 'peer-presentation-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload and read
CREATE POLICY "Authenticated users can upload peer presentation attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'peer-presentation-attachments');

CREATE POLICY "Authenticated users can read peer presentation attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'peer-presentation-attachments');

CREATE POLICY "Auth users can delete peer presentation attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'peer-presentation-attachments');

-- =============================================================================
-- 5. RLS: group_session_activities (2 policies to avoid timeout)
-- =============================================================================
ALTER TABLE public.group_session_activities ENABLE ROW LEVEL SECURITY;

-- Admin/instructor: full access
CREATE POLICY "Admin and instructors have full access to session activities"
  ON public.group_session_activities
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'instructor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'instructor'::app_role)
  );

-- Group members: SELECT + INSERT + UPDATE
CREATE POLICY "Group members can view and manage session activities"
  ON public.group_session_activities
  FOR ALL
  TO authenticated
  USING (
    public.is_session_group_member(session_id)
  )
  WITH CHECK (
    public.is_session_group_member(session_id)
  );

-- =============================================================================
-- 6. RLS: group_session_activity_attachments (2 policies)
-- =============================================================================
ALTER TABLE public.group_session_activity_attachments ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin has full access to activity attachments"
  ON public.group_session_activity_attachments
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Group members can view all attachments for activities they can access;
-- can insert/delete their own attachments
CREATE POLICY "Group members can manage activity attachments"
  ON public.group_session_activity_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_session_activities gsa
      WHERE gsa.id = activity_id
        AND public.is_session_group_member(gsa.session_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_session_activities gsa
      WHERE gsa.id = activity_id
        AND public.is_session_group_member(gsa.session_id)
    )
  );
