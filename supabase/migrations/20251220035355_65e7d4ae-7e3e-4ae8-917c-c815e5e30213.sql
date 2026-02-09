-- Create table for Circle connection requests
CREATE TABLE public.circle_interest_registrations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.circle_interest_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all Circle interest registrations"
ON public.circle_interest_registrations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own Circle interest registrations"
ON public.circle_interest_registrations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Circle interest registration"
ON public.circle_interest_registrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_circle_interest_registrations_updated_at
BEFORE UPDATE ON public.circle_interest_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();