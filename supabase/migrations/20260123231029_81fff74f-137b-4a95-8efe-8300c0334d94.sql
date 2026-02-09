-- Create junction table for module to collection links
CREATE TABLE public.module_collection_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID NOT NULL REFERENCES public.program_modules(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES public.resource_collections(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (module_id, collection_id)
);

-- Enable RLS
ALTER TABLE public.module_collection_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage all module collection links
CREATE POLICY "Admins can manage module collection links"
ON public.module_collection_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view module collection links
CREATE POLICY "Authenticated users can view module collection links"
ON public.module_collection_links
FOR SELECT
USING (auth.role() = 'authenticated');