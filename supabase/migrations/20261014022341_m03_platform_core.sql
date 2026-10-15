-- M03: Platform core (audit, outbox, attachments, notifications, entity links)

CREATE TABLE platform.audit_events (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  actor_id UUID REFERENCES identity.profiles (id),
  action TEXT NOT NULL,
  scope_type public.scope_type,
  scope_id UUID,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  reason TEXT,
  correlation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_scope_idx ON platform.audit_events (scope_type, scope_id, created_at DESC);
CREATE INDEX audit_events_resource_idx ON platform.audit_events (resource_type, resource_id);

CREATE TABLE platform.domain_events_outbox (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  event_name TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  aggregate_id UUID NOT NULL,
  aggregate_version INT NOT NULL DEFAULT 1,
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  actor_id UUID REFERENCES identity.profiles (id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id UUID NOT NULL,
  causation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX outbox_unpublished_idx
  ON platform.domain_events_outbox (created_at)
  WHERE published_at IS NULL;

CREATE TABLE platform.event_inbox_dedup (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumer TEXT NOT NULL
);

CREATE TABLE platform.attachments (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  entity_type TEXT,
  entity_id UUID,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER attachments_set_updated_at
  BEFORE UPDATE ON platform.attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE platform.attachment_versions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  attachment_id UUID NOT NULL REFERENCES platform.attachments (id) ON DELETE CASCADE,
  version INT NOT NULL,
  storage_path TEXT NOT NULL,
  checksum_sha256 TEXT,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attachment_versions_unique UNIQUE (attachment_id, version)
);

CREATE TABLE platform.comments (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES identity.profiles (id),
  body TEXT NOT NULL,
  parent_comment_id UUID REFERENCES platform.comments (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX comments_entity_idx ON platform.comments (entity_type, entity_id);

CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON platform.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE platform.mentions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  comment_id UUID NOT NULL REFERENCES platform.comments (id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentions_unique UNIQUE (comment_id, mentioned_user_id)
);

CREATE TABLE platform.notifications (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  recipient_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity_type TEXT,
  entity_id UUID,
  scope_type public.scope_type,
  scope_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_idx
  ON platform.notifications (recipient_id, created_at DESC);

CREATE TABLE platform.notification_receipts (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  notification_id UUID NOT NULL REFERENCES platform.notifications (id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_receipts_unique UNIQUE (notification_id, recipient_id)
);

CREATE TABLE platform.entity_links (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  from_kind TEXT NOT NULL,
  from_id UUID NOT NULL,
  to_kind TEXT NOT NULL,
  to_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_links_unique UNIQUE (from_kind, from_id, to_kind, to_id, relation_type)
);

CREATE INDEX entity_links_to_idx ON platform.entity_links (to_kind, to_id);
CREATE INDEX entity_links_from_idx ON platform.entity_links (from_kind, from_id);

CREATE TABLE platform.saved_views (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER saved_views_set_updated_at
  BEFORE UPDATE ON platform.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE platform.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  job_type TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_jobs_idempotency UNIQUE (job_type, idempotency_key)
);

CREATE INDEX scheduled_jobs_due_idx
  ON platform.scheduled_jobs (run_at)
  WHERE status = 'queued';

CREATE TABLE platform.import_batches (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  domain TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_by UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER import_batches_set_updated_at
  BEFORE UPDATE ON platform.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE platform.export_jobs (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  requested_by UUID NOT NULL REFERENCES identity.profiles (id),
  export_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  storage_path TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER export_jobs_set_updated_at
  BEFORE UPDATE ON platform.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
