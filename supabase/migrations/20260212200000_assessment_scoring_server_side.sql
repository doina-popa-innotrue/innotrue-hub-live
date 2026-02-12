-- =============================================================================
-- Migration: Remove client-side assessment scoring access
-- =============================================================================
-- Scoring is now computed server-side via compute-assessment-scores edge function.
-- Only admin ALL policies remain on these tables.
-- =============================================================================

-- Remove the authenticated SELECT policies added in 20260212190000
DROP POLICY IF EXISTS "Authenticated users can view option scores of active assessment" ON public.assessment_option_scores;
DROP POLICY IF EXISTS "Authenticated users can view interpretations of active assessme" ON public.assessment_interpretations;

-- Also drop the original policy names in case they weren't previously removed
DROP POLICY IF EXISTS "Public can view option scores of active assessments" ON public.assessment_option_scores;
DROP POLICY IF EXISTS "Public can view interpretations of active assessments" ON public.assessment_interpretations;
