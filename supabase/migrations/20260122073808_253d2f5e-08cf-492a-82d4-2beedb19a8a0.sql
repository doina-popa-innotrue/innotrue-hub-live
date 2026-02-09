-- Enable RLS on credit_source_types table
ALTER TABLE public.credit_source_types ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only authenticated users to read credit source types
CREATE POLICY "Authenticated users can view credit source types"
ON public.credit_source_types
FOR SELECT
USING (auth.uid() IS NOT NULL);