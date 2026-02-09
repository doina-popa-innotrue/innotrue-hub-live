-- Create table for wheel domain reflections
CREATE TABLE public.wheel_domain_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wheel_domain_reflections ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own domain reflections" 
ON public.wheel_domain_reflections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own domain reflections" 
ON public.wheel_domain_reflections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domain reflections" 
ON public.wheel_domain_reflections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own domain reflections" 
ON public.wheel_domain_reflections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_wheel_domain_reflections_updated_at
BEFORE UPDATE ON public.wheel_domain_reflections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_wheel_domain_reflections_user_category ON public.wheel_domain_reflections(user_id, category);