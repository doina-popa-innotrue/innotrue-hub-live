-- Junction tables for linking domains and questions to learning resources

-- Domain-level program links
CREATE TABLE public.domain_program_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(domain_id, program_id)
);

-- Domain-level module links (referencing program_modules)
CREATE TABLE public.domain_module_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(domain_id, module_id)
);

-- Domain-level resource library links
CREATE TABLE public.domain_resource_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.capability_domains(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(domain_id, resource_id)
);

-- Question-level program links (more granular)
CREATE TABLE public.question_program_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(question_id, program_id)
);

-- Question-level module links
CREATE TABLE public.question_module_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(question_id, module_id)
);

-- Question-level resource library links
CREATE TABLE public.question_resource_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.capability_domain_questions(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(question_id, resource_id)
);

-- Enable RLS on all tables
ALTER TABLE public.domain_program_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_module_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_resource_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_program_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_module_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_resource_links ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (using has_role function)
CREATE POLICY "Admins can manage domain_program_links" ON public.domain_program_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage domain_module_links" ON public.domain_module_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage domain_resource_links" ON public.domain_resource_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage question_program_links" ON public.question_program_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage question_module_links" ON public.question_module_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage question_resource_links" ON public.question_resource_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read (for viewing recommendations)
CREATE POLICY "Authenticated users can view domain_program_links" ON public.domain_program_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view domain_module_links" ON public.domain_module_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view domain_resource_links" ON public.domain_resource_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view question_program_links" ON public.question_program_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view question_module_links" ON public.question_module_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view question_resource_links" ON public.question_resource_links
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_domain_program_links_domain ON public.domain_program_links(domain_id);
CREATE INDEX idx_domain_module_links_domain ON public.domain_module_links(domain_id);
CREATE INDEX idx_domain_resource_links_domain ON public.domain_resource_links(domain_id);
CREATE INDEX idx_question_program_links_question ON public.question_program_links(question_id);
CREATE INDEX idx_question_module_links_question ON public.question_module_links(question_id);
CREATE INDEX idx_question_resource_links_question ON public.question_resource_links(question_id);