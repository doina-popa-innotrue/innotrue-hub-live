-- =============================================================================
-- SC-7: Search Performance — GIN Trigram Indexes
-- =============================================================================
-- ilike '%term%' (leading wildcard) forces sequential scans on B-tree indexes.
-- GIN trigram indexes allow PostgreSQL to use index scans for leading-wildcard
-- patterns automatically — no frontend code changes needed.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- profiles.name — searched in 6+ places: BulkEnrollmentDialog, BulkCreditGrantDialog,
-- ExcludedUsersManager, OrganizationDetail, EnrolmentsManagement, etc.
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING gin (name gin_trgm_ops);

-- notifications.title + message — NotificationsManagement.tsx
-- uses .or(`title.ilike.%term%,message.ilike.%term%`)
CREATE INDEX IF NOT EXISTS idx_notifications_title_trgm
  ON public.notifications USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notifications_message_trgm
  ON public.notifications USING gin (message gin_trgm_ops);

-- organizations.name — OrganizationDetail.tsx uses .ilike("name", `%search%`)
CREATE INDEX IF NOT EXISTS idx_organizations_name_trgm
  ON public.organizations USING gin (name gin_trgm_ops);
