-- Create auth_contexts table for admin-configured landing page variations
CREATE TABLE public.auth_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  context_type TEXT NOT NULL CHECK (context_type IN ('program', 'track', 'organization', 'custom')),
  
  -- Display content
  headline TEXT NOT NULL,
  subheadline TEXT,
  description TEXT,
  
  -- Features to display (JSON array of {icon, title, description})
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Branding overrides (optional)
  logo_url TEXT,
  primary_color TEXT,
  
  -- Linked entities (optional - used for auto-assignment)
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- Default signup behavior
  default_to_signup BOOLEAN DEFAULT true,
  auto_enroll_program BOOLEAN DEFAULT false,
  auto_assign_track BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create signup_contexts table to track what context a user signed up through
CREATE TABLE public.signup_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_context_id UUID REFERENCES public.auth_contexts(id) ON DELETE SET NULL,
  context_slug TEXT NOT NULL,
  context_type TEXT NOT NULL,
  
  -- Snapshot of what was linked at signup time
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  track_id UUID REFERENCES public.tracks(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- Was this context applied?
  program_enrolled BOOLEAN DEFAULT false,
  track_assigned BOOLEAN DEFAULT false,
  organization_joined BOOLEAN DEFAULT false,
  
  -- Additional metadata from URL params
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.auth_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_contexts ENABLE ROW LEVEL SECURITY;

-- Auth contexts: public read for active contexts, admin full access
CREATE POLICY "Anyone can view active auth contexts"
  ON public.auth_contexts FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage auth contexts"
  ON public.auth_contexts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Signup contexts: users can see their own, admins can see all
CREATE POLICY "Users can view their own signup contexts"
  ON public.signup_contexts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all signup contexts"
  ON public.signup_contexts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage signup contexts"
  ON public.signup_contexts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can insert signup contexts (used by edge functions)
CREATE POLICY "Service role can insert signup contexts"
  ON public.signup_contexts FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_auth_contexts_slug ON public.auth_contexts(slug);
CREATE INDEX idx_auth_contexts_type ON public.auth_contexts(context_type);
CREATE INDEX idx_signup_contexts_user ON public.signup_contexts(user_id);
CREATE INDEX idx_signup_contexts_context ON public.signup_contexts(context_slug);

-- Add updated_at trigger
CREATE TRIGGER update_auth_contexts_updated_at
  BEFORE UPDATE ON public.auth_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();