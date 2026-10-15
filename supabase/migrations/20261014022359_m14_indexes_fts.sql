-- M14: Additional indexes and full-text search (exclude journal body from shared search)

CREATE INDEX IF NOT EXISTS tasks_title_trgm ON planning.tasks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS notes_title_trgm ON personal.notes USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS articles_title_trgm ON collaboration.articles USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_first_name_trgm
  ON crm.crm_contacts USING GIN (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_last_name_trgm
  ON crm.crm_contacts USING GIN (last_name gin_trgm_ops);

ALTER TABLE planning.tasks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS tasks_search_vector_idx ON planning.tasks USING GIN (search_vector);

ALTER TABLE personal.notes
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS notes_search_vector_idx ON personal.notes USING GIN (search_vector);

ALTER TABLE collaboration.articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS articles_search_vector_idx ON collaboration.articles USING GIN (search_vector);

-- Cursor pagination helpers
CREATE INDEX IF NOT EXISTS tasks_scope_created_idx
  ON planning.tasks (scope_type, scope_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS invoices_org_created_idx
  ON finance_business.invoices (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS financial_journals_book_created_idx
  ON finance_personal.financial_journals (book_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS outbox_aggregate_idx
  ON platform.domain_events_outbox (aggregate_id, aggregate_version);

-- Grant usage on schemas to authenticated / service roles used by Supabase
GRANT USAGE ON SCHEMA identity, platform, planning, personal, workforce, crm,
  finance_personal, finance_business, collaboration TO authenticated, service_role, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA planning TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA personal TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workforce TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance_personal TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance_business TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA collaboration TO authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA planning TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA personal TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workforce TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA crm TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance_personal TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance_business TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA collaboration TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA identity GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA planning GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA personal GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA workforce GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_personal GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_business GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA collaboration GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
