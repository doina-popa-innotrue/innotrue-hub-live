-- xAPI Integration: tables for Rise xAPI content launch + lightweight LRS
-- Supports Rise xAPI (Tin Can) export launch flow with auth token management
-- and xAPI statement storage for automatic progress tracking.

-- ─── 1. Add content_package_type to program_modules ─────────────────
-- Distinguishes Rise Web exports (proxied via serve-content-package) from
-- Rise xAPI exports (launched natively with xAPI tracking).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_modules'
      AND column_name = 'content_package_type'
  ) THEN
    ALTER TABLE public.program_modules
      ADD COLUMN content_package_type TEXT DEFAULT 'web'
      CHECK (content_package_type IN ('web', 'xapi'));

    COMMENT ON COLUMN public.program_modules.content_package_type IS
      'Type of content package: web (Rise Web embed via proxy) or xapi (Rise xAPI with tracking)';
  END IF;
END $$;

-- ─── 2. xapi_sessions — Per-launch session with one-time auth tokens ──
CREATE TABLE IF NOT EXISTS public.xapi_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,

  -- Auth token for this session (used in xAPI Authorization header)
  auth_token TEXT NOT NULL UNIQUE,
  -- Whether the token has been consumed by the AU's fetch request
  token_consumed BOOLEAN DEFAULT false,
  -- Session lifecycle
  status TEXT DEFAULT 'launched' CHECK (status IN ('launched', 'initialized', 'completed', 'terminated', 'abandoned')),

  launched_at TIMESTAMPTZ DEFAULT now(),
  initialized_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xapi_sessions_auth_token ON public.xapi_sessions(auth_token);
CREATE INDEX IF NOT EXISTS idx_xapi_sessions_user_module ON public.xapi_sessions(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_xapi_sessions_status ON public.xapi_sessions(status) WHERE status IN ('launched', 'initialized');

-- ─── 3. xapi_statements — Stored xAPI statements ───────────────────
CREATE TABLE IF NOT EXISTS public.xapi_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link back to session
  session_id UUID NOT NULL REFERENCES public.xapi_sessions(id) ON DELETE CASCADE,
  -- Denormalized for fast queries
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,

  -- xAPI statement core fields
  statement_id TEXT,            -- The xAPI statement UUID (from the AU)
  verb_id TEXT NOT NULL,        -- Full verb IRI
  verb_display TEXT,            -- Human-readable verb name (e.g. "completed")
  object_id TEXT NOT NULL,      -- Activity IRI
  object_name TEXT,             -- Human-readable activity name

  -- Result fields (nullable — not all verbs have results)
  result_completion BOOLEAN,
  result_success BOOLEAN,
  result_score_scaled NUMERIC,
  result_score_raw NUMERIC,
  result_duration TEXT,         -- ISO 8601 duration

  -- Full statement JSON for audit / AI analysis
  raw_statement JSONB NOT NULL,

  statement_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xapi_statements_session ON public.xapi_statements(session_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_user_module ON public.xapi_statements(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_verb ON public.xapi_statements(verb_id);

-- ─── 4. RLS Policies ────────────────────────────────────────────────

ALTER TABLE public.xapi_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xapi_statements ENABLE ROW LEVEL SECURITY;

-- Sessions: users can view their own; service role manages all
CREATE POLICY "Users can view own xapi sessions"
  ON public.xapi_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Statements: users can view their own; edge functions insert via service role
CREATE POLICY "Users can view own xapi statements"
  ON public.xapi_statements FOR SELECT
  USING (auth.uid() = user_id);

-- Service role bypasses RLS for insert/update operations (edge functions use service key)

-- ─── 5. Auto-update timestamps ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_xapi_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xapi_sessions_updated_at ON public.xapi_sessions;
CREATE TRIGGER trg_xapi_sessions_updated_at
  BEFORE UPDATE ON public.xapi_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_xapi_sessions_updated_at();
