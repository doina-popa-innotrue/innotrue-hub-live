-- Create a junction table for linking resource library items to client-specific content
CREATE TABLE IF NOT EXISTS public.module_client_content_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_client_content_id UUID NOT NULL REFERENCES public.module_client_content(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resource_library(id) ON DELETE CASCADE,
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(module_client_content_id, resource_id)
);

-- Enable RLS
ALTER TABLE public.module_client_content_resources ENABLE ROW LEVEL SECURITY;

-- Admins can manage all client content resources
CREATE POLICY "Admins can manage client content resources"
  ON public.module_client_content_resources
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Instructors can manage client content resources
CREATE POLICY "Instructors can manage client content resources"
  ON public.module_client_content_resources
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'instructor')
  );

-- Coaches can manage client content resources
CREATE POLICY "Coaches can manage client content resources"
  ON public.module_client_content_resources
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'coach')
  );

-- Clients can view their own assigned resources
CREATE POLICY "Clients can view their own content resources"
  ON public.module_client_content_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.module_client_content mcc
      WHERE mcc.id = module_client_content_id
      AND mcc.user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_module_client_content_resources_content_id ON public.module_client_content_resources(module_client_content_id);
CREATE INDEX IF NOT EXISTS idx_module_client_content_resources_resource_id ON public.module_client_content_resources(resource_id);