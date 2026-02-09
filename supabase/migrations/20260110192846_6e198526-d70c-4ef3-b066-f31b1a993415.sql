-- Fix overly permissive INSERT policy by requiring email
DROP POLICY IF EXISTS "Public can submit assessment responses" ON public.assessment_responses;

CREATE POLICY "Public can submit assessment responses with email" ON public.assessment_responses
  FOR INSERT WITH CHECK (email IS NOT NULL AND email <> '');