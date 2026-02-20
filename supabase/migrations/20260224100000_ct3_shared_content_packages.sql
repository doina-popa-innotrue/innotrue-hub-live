-- CT3: Shared Content Packages & Cross-Program Completion
--
-- CT3a: content_packages — shared content library (upload once, assign to many modules)
-- CT3b: content_completions — cross-program completion tracking (complete once, recognized everywhere)
-- Adds content_package_id FK to program_modules for linking modules to shared content.

-- ============================================================
-- 1. content_packages — Shared content library
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  -- Storage path prefix in module-content-packages bucket (e.g., "shared/{uuid}")
  storage_path TEXT NOT NULL,
  -- 'web' (Rise Web embed) or 'xapi' (Rise xAPI with tracking)
  package_type TEXT NOT NULL DEFAULT 'web'
    CHECK (package_type IN ('web', 'xapi')),
  file_count INTEGER DEFAULT 0,
  original_filename TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_packages IS
  'Shared content library: each row is a Rise ZIP export that can be assigned to many program_modules.';
COMMENT ON COLUMN public.content_packages.storage_path IS
  'Folder path in module-content-packages bucket (e.g., "shared/abc-123"). All extracted files live under this prefix.';
COMMENT ON COLUMN public.content_packages.package_type IS
  'web = Rise Web embed via iframe; xapi = Rise xAPI with LMS tracking + auto-completion.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_packages_title
  ON public.content_packages(title);
CREATE INDEX IF NOT EXISTS idx_content_packages_active
  ON public.content_packages(is_active)
  WHERE is_active = true;

-- RLS
ALTER TABLE public.content_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to content_packages"
  ON public.content_packages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view content_packages"
  ON public.content_packages FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role) OR
    has_role(auth.uid(), 'coach'::app_role)
  );

CREATE POLICY "Clients can view content_packages"
  ON public.content_packages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role));

-- Trigger: auto-update updated_at
CREATE TRIGGER update_content_packages_updated_at
  BEFORE UPDATE ON public.content_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. content_completions — Cross-program completion tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_package_id UUID NOT NULL REFERENCES public.content_packages(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Track which module/enrollment triggered this completion
  source_module_id UUID REFERENCES public.program_modules(id) ON DELETE SET NULL,
  source_enrollment_id UUID REFERENCES public.client_enrollments(id) ON DELETE SET NULL,
  -- Optional: score data from xAPI result
  result_score_scaled NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One completion record per user per content package
  UNIQUE(user_id, content_package_id)
);

COMMENT ON TABLE public.content_completions IS
  'Records when a user completes a specific content package, regardless of which module/program it was through. Enables cross-program completion recognition.';
COMMENT ON COLUMN public.content_completions.source_module_id IS
  'The program_module through which completion was first achieved.';
COMMENT ON COLUMN public.content_completions.source_enrollment_id IS
  'The enrollment through which completion was first achieved.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_completions_user
  ON public.content_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_completions_content_package
  ON public.content_completions(content_package_id);

-- RLS
ALTER TABLE public.content_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own content_completions"
  ON public.content_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all completions
CREATE POLICY "Admins can view all content_completions"
  ON public.content_completions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view all completions (needed for cross-program tracking queries)
CREATE POLICY "Staff can view all content_completions"
  ON public.content_completions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'instructor'::app_role) OR
    has_role(auth.uid(), 'coach'::app_role)
  );

-- Inserts/updates are done via service role (edge functions) only — no user-facing write policies

-- ============================================================
-- 3. program_modules.content_package_id — FK to shared content
-- ============================================================

ALTER TABLE public.program_modules
  ADD COLUMN IF NOT EXISTS content_package_id UUID
    REFERENCES public.content_packages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.program_modules.content_package_id IS
  'FK to shared content_packages table. When set, this module uses shared content. Takes precedence over legacy content_package_path.';

CREATE INDEX IF NOT EXISTS idx_program_modules_content_package
  ON public.program_modules(content_package_id)
  WHERE content_package_id IS NOT NULL;
