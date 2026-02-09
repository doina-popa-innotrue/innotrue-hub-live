-- Create add_ons table for named add-on products
CREATE TABLE public.add_ons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create add_on_features table to link features to add-ons
CREATE TABLE public.add_on_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(add_on_id, feature_id)
);

-- Create user_add_ons table for assignments with optional expiration
CREATE TABLE public.user_add_ons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  granted_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, add_on_id)
);

-- Enable RLS
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.add_on_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_add_ons ENABLE ROW LEVEL SECURITY;

-- RLS policies for add_ons
CREATE POLICY "Admins can manage all add-ons"
  ON public.add_ons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active add-ons"
  ON public.add_ons FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- RLS policies for add_on_features
CREATE POLICY "Admins can manage add-on features"
  ON public.add_on_features FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view add-on features"
  ON public.add_on_features FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS policies for user_add_ons
CREATE POLICY "Admins can manage all user add-ons"
  ON public.user_add_ons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own add-ons"
  ON public.user_add_ons FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_add_ons_updated_at
  BEFORE UPDATE ON public.add_ons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();