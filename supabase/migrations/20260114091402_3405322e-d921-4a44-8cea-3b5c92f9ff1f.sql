-- Add admin SELECT policies for capability_domain_notes
CREATE POLICY "Admins can view all domain notes"
ON public.capability_domain_notes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin SELECT policies for capability_question_notes
CREATE POLICY "Admins can view all question notes"
ON public.capability_question_notes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));