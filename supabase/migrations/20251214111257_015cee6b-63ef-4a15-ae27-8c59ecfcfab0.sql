-- First add is_primary column to program_instructors
ALTER TABLE public.program_instructors ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Drop tables if they were partially created
DROP TABLE IF EXISTS public.client_badge_credentials;
DROP TABLE IF EXISTS public.client_badges;
DROP TABLE IF EXISTS public.program_badge_credentials;
DROP TABLE IF EXISTS public.program_badges;

-- Program badges definition (one optional badge per program)
CREATE TABLE public.program_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(program_id)
);

-- Multiple credential services per badge
CREATE TABLE public.program_badge_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_badge_id UUID NOT NULL REFERENCES public.program_badges(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_display_name TEXT,
  credential_template_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual badge instances issued to clients
CREATE TABLE public.client_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_badge_id UUID NOT NULL REFERENCES public.program_badges(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.client_enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  image_path TEXT,
  issued_at TIMESTAMP WITH TIME ZONE,
  issued_by UUID,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_badge_id)
);

-- Client's credential links for each service
CREATE TABLE public.client_badge_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_badge_id UUID NOT NULL REFERENCES public.client_badges(id) ON DELETE CASCADE,
  program_badge_credential_id UUID NOT NULL REFERENCES public.program_badge_credentials(id) ON DELETE CASCADE,
  acceptance_url TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.program_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_badge_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_badge_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_badges
CREATE POLICY "Admins can manage all program badges"
ON public.program_badges FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active program badges"
ON public.program_badges FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS Policies for program_badge_credentials
CREATE POLICY "Admins can manage all badge credentials"
ON public.program_badge_credentials FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view badge credentials"
ON public.program_badge_credentials FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_badges
CREATE POLICY "Admins can manage all client badges"
ON public.client_badges FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own badges"
ON public.client_badges FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own badges visibility"
ON public.client_badges FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Primary instructors can manage badges for their programs"
ON public.client_badges FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM program_badges pb
    JOIN program_instructors pi ON pi.program_id = pb.program_id
    WHERE pb.id = client_badges.program_badge_id
    AND pi.instructor_id = auth.uid()
    AND pi.is_primary = true
  )
);

CREATE POLICY "Anyone can view public badges for public profiles"
ON public.client_badges FOR SELECT
USING (
  is_public = true AND 
  EXISTS (
    SELECT 1 FROM public_profile_settings pps
    WHERE pps.user_id = client_badges.user_id AND pps.is_public = true
  )
);

-- RLS Policies for client_badge_credentials
CREATE POLICY "Admins can manage all client badge credentials"
ON public.client_badge_credentials FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own badge credentials"
ON public.client_badge_credentials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_badges cb
    WHERE cb.id = client_badge_credentials.client_badge_id
    AND cb.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own badge credentials"
ON public.client_badge_credentials FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM client_badges cb
    WHERE cb.id = client_badge_credentials.client_badge_id
    AND cb.user_id = auth.uid()
  )
);

CREATE POLICY "Primary instructors can manage client badge credentials"
ON public.client_badge_credentials FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM client_badges cb
    JOIN program_badges pb ON pb.id = cb.program_badge_id
    JOIN program_instructors pi ON pi.program_id = pb.program_id
    WHERE cb.id = client_badge_credentials.client_badge_id
    AND pi.instructor_id = auth.uid()
    AND pi.is_primary = true
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_program_badges_updated_at
BEFORE UPDATE ON public.program_badges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_badges_updated_at
BEFORE UPDATE ON public.client_badges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();