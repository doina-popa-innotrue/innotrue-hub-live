-- Add url and cost fields to psychometric_assessments
ALTER TABLE public.psychometric_assessments 
ADD COLUMN url text,
ADD COLUMN cost numeric(10,2);