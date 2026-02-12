-- =============================================================================
-- Migration: Create missing module-assessment-attachments storage bucket
-- =============================================================================
-- This bucket was defined in migration 20251203081131 but may not have been
-- created on all Supabase projects. This migration ensures it exists.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('module-assessment-attachments', 'module-assessment-attachments', false)
ON CONFLICT (id) DO NOTHING;
