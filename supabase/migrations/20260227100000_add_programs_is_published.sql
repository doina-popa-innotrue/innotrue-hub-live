-- Add is_published column to programs table
-- Decouples "active/not archived" (is_active) from "visible to clients" (is_published)
-- is_active=true, is_published=false → Draft (admin can see, clients cannot)
-- is_active=true, is_published=true  → Published (visible everywhere)
-- is_active=false                    → Archived (hidden from clients, admin Archived tab)

ALTER TABLE programs
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;

-- Backfill: all currently active programs are already live → set them as published
UPDATE programs SET is_published = true WHERE is_active = true;

-- Index for client-facing queries that filter on both columns
CREATE INDEX idx_programs_active_published ON programs (is_active, is_published)
  WHERE is_active = true AND is_published = true;

COMMENT ON COLUMN programs.is_published IS 'Controls visibility in client-facing pages (Explore Programs, org programs). Draft programs (is_active=true, is_published=false) are only visible to admins.';
