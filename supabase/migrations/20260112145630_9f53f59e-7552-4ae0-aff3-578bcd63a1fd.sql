
-- =============================================================================
-- UNIFIED SESSIONS ARCHITECTURE - COMPLETE SETUP
-- =============================================================================

-- First, drop any partially created tables/functions from failed migration
DROP TABLE IF EXISTS public.session_participants CASCADE;
DROP TABLE IF EXISTS public.session_module_links CASCADE;
DROP TABLE IF EXISTS public.session_group_links CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.session_type_roles CASCADE;
DROP TABLE IF EXISTS public.session_types CASCADE;
DROP FUNCTION IF EXISTS public.is_session_instructor_or_coach(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_session_participant(UUID, UUID);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- 1. Session Types
CREATE TABLE public.session_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  default_duration_minutes INTEGER DEFAULT 60,
  max_participants INTEGER,
  allow_self_registration BOOLEAN DEFAULT false,
  feature_key TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Session Type Roles
CREATE TABLE public.session_type_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type_id UUID REFERENCES public.session_types(id) ON DELETE CASCADE NOT NULL,
  role_name TEXT NOT NULL,
  description TEXT,
  max_per_session INTEGER,
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_type_id, role_name)
);

-- 3. Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type_id UUID REFERENCES public.session_types(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_date TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'requested', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  max_participants INTEGER,
  allow_self_registration BOOLEAN DEFAULT false,
  registration_deadline TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Session-Group Links
CREATE TABLE public.session_group_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, group_id)
);

-- 5. Session-Module Links
CREATE TABLE public.session_module_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.program_modules(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, module_id, enrollment_id)
);

-- 6. Session Participants
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.session_type_roles(id) ON DELETE SET NULL,
  custom_role TEXT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('invited', 'registered', 'confirmed', 'attended', 'no_show', 'cancelled')),
  registered_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  attended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_session_instructor_or_coach(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM session_module_links sml
    JOIN program_modules pm ON pm.id = sml.module_id
    JOIN program_instructors pi ON pi.program_id = pm.program_id
    WHERE sml.session_id = p_session_id AND pi.instructor_id = p_user_id
    UNION
    SELECT 1
    FROM session_group_links sgl
    JOIN groups g ON g.id = sgl.group_id
    JOIN program_instructors pi ON pi.program_id = g.program_id
    WHERE sgl.session_id = p_session_id AND pi.instructor_id = p_user_id
    UNION
    SELECT 1
    FROM session_participants sp
    JOIN client_coaches cc ON cc.client_id = sp.user_id
    WHERE sp.session_id = p_session_id AND cc.coach_id = p_user_id
    UNION
    SELECT 1
    FROM session_module_links sml
    JOIN program_modules pm ON pm.id = sml.module_id
    JOIN program_coaches pc ON pc.program_id = pm.program_id
    WHERE sml.session_id = p_session_id AND pc.coach_id = p_user_id
    UNION
    SELECT 1
    FROM session_group_links sgl
    JOIN groups g ON g.id = sgl.group_id
    JOIN program_coaches pc ON pc.program_id = g.program_id
    WHERE sgl.session_id = p_session_id AND pc.coach_id = p_user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants
    WHERE session_id = p_session_id AND user_id = p_user_id
  )
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.session_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_type_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_module_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Session Types policies
CREATE POLICY "st_select_active" ON public.session_types FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "st_all_admin" ON public.session_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "st_all_instructor" ON public.session_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "st_all_coach" ON public.session_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));

-- Session Type Roles policies
CREATE POLICY "str_select" ON public.session_type_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "str_all_admin" ON public.session_type_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "str_all_instructor" ON public.session_type_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "str_all_coach" ON public.session_type_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));

-- Sessions policies
CREATE POLICY "s_all_admin" ON public.sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "s_all_instructor" ON public.sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "s_all_coach" ON public.sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "s_select_participant" ON public.sessions FOR SELECT TO authenticated USING (public.is_session_participant(id, auth.uid()) OR public.is_session_instructor_or_coach(id, auth.uid()));
CREATE POLICY "s_select_registration" ON public.sessions FOR SELECT TO authenticated USING (allow_self_registration = true AND status IN ('scheduled', 'confirmed') AND (registration_deadline IS NULL OR registration_deadline > now()));

-- Session Group Links policies
CREATE POLICY "sgl_all_admin" ON public.session_group_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sgl_all_instructor" ON public.session_group_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "sgl_all_coach" ON public.session_group_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "sgl_select_participant" ON public.session_group_links FOR SELECT TO authenticated USING (public.is_session_participant(session_id, auth.uid()) OR public.is_session_instructor_or_coach(session_id, auth.uid()));

-- Session Module Links policies
CREATE POLICY "sml_all_admin" ON public.session_module_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sml_all_instructor" ON public.session_module_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "sml_all_coach" ON public.session_module_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "sml_select_participant" ON public.session_module_links FOR SELECT TO authenticated USING (public.is_session_participant(session_id, auth.uid()) OR public.is_session_instructor_or_coach(session_id, auth.uid()));

-- Session Participants policies (privacy: users can only see their own participation)
CREATE POLICY "sp_all_admin" ON public.session_participants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sp_all_instructor" ON public.session_participants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "sp_all_coach" ON public.session_participants FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coach'));
CREATE POLICY "sp_select_own" ON public.session_participants FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sp_insert_self" ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM sessions s WHERE s.id = session_id AND s.allow_self_registration = true AND s.status IN ('scheduled', 'confirmed') AND (s.registration_deadline IS NULL OR s.registration_deadline > now())
  ));
CREATE POLICY "sp_update_own" ON public.session_participants FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sp_delete_own" ON public.session_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_sessions_type ON public.sessions(session_type_id);
CREATE INDEX idx_sessions_date ON public.sessions(session_date);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_created_by ON public.sessions(created_by);
CREATE INDEX idx_sp_session ON public.session_participants(session_id);
CREATE INDEX idx_sp_user ON public.session_participants(user_id);
CREATE INDEX idx_sp_role ON public.session_participants(role_id);
CREATE INDEX idx_sgl_session ON public.session_group_links(session_id);
CREATE INDEX idx_sgl_group ON public.session_group_links(group_id);
CREATE INDEX idx_sml_session ON public.session_module_links(session_id);
CREATE INDEX idx_sml_module ON public.session_module_links(module_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER update_session_types_updated_at
  BEFORE UPDATE ON public.session_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_participants_updated_at
  BEFORE UPDATE ON public.session_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- INSERT FEATURES FOR CONSUMPTION TRACKING (without category)
-- =============================================================================

INSERT INTO public.features (key, name, description, is_consumable)
VALUES 
  ('session_coaching', 'Coaching Sessions', 'One-on-one coaching sessions', true),
  ('session_group', 'Group Sessions', 'Group coaching and mastermind sessions', true),
  ('session_workshop', 'Workshops', 'Workshop and training sessions', true),
  ('session_review_board', 'Review Board Sessions', 'Review board mock sessions with evaluators', true),
  ('session_peer_coaching', 'Peer Coaching', 'Peer-to-peer coaching sessions', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- DEFAULT SESSION TYPES
-- =============================================================================

INSERT INTO public.session_types (name, description, default_duration_minutes, max_participants, allow_self_registration, feature_key) VALUES
  ('coaching', 'One-on-one coaching session', 60, 2, false, 'session_coaching'),
  ('group_coaching', 'Group coaching session', 90, 12, true, 'session_group'),
  ('workshop', 'Interactive workshop session', 120, 30, true, 'session_workshop'),
  ('mastermind', 'Mastermind group session', 90, 8, true, 'session_group'),
  ('review_board_mock', 'Review board mock session with evaluators', 60, 4, true, 'session_review_board'),
  ('peer_coaching', 'Peer-to-peer coaching session', 45, 2, true, 'session_peer_coaching'),
  ('office_hours', 'Open office hours', 60, 10, true, 'session_group'),
  ('webinar', 'Webinar or presentation', 60, 100, true, 'session_workshop')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- DEFAULT ROLES FOR SESSION TYPES
-- =============================================================================

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'presenter', 'The person presenting their work for review', 1, true, 1 FROM public.session_types WHERE name = 'review_board_mock';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'evaluator', 'Evaluator/Judge providing feedback', 3, true, 2 FROM public.session_types WHERE name = 'review_board_mock';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'observer', 'Observer learning from the session', NULL, false, 3 FROM public.session_types WHERE name = 'review_board_mock';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'facilitator', 'Session facilitator/leader', 2, true, 1 FROM public.session_types WHERE name = 'workshop';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'participant', 'Workshop participant', NULL, false, 2 FROM public.session_types WHERE name = 'workshop';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'hot_seat', 'Person in the hot seat receiving focus', 1, true, 1 FROM public.session_types WHERE name = 'mastermind';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'member', 'Mastermind group member', NULL, false, 2 FROM public.session_types WHERE name = 'mastermind';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'moderator', 'Session moderator', 1, false, 3 FROM public.session_types WHERE name = 'mastermind';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'coach', 'Person acting as coach', 1, true, 1 FROM public.session_types WHERE name = 'peer_coaching';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'coachee', 'Person being coached', 1, true, 2 FROM public.session_types WHERE name = 'peer_coaching';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'presenter', 'Webinar presenter', 3, true, 1 FROM public.session_types WHERE name = 'webinar';

INSERT INTO public.session_type_roles (session_type_id, role_name, description, max_per_session, is_required, order_index)
SELECT id, 'attendee', 'Webinar attendee', NULL, false, 2 FROM public.session_types WHERE name = 'webinar';
