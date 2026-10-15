-- M12: Collaboration, automation, analytics storage

CREATE TABLE collaboration.knowledge_spaces (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  project_id UUID REFERENCES planning.projects (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_spaces_scope_idx
  ON collaboration.knowledge_spaces (scope_type, scope_id);

CREATE TRIGGER knowledge_spaces_set_updated_at
  BEFORE UPDATE ON collaboration.knowledge_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE collaboration.articles (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  knowledge_space_id UUID NOT NULL REFERENCES collaboration.knowledge_spaces (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  body_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX articles_space_idx ON collaboration.articles (knowledge_space_id);
CREATE INDEX articles_tags_idx ON collaboration.articles USING GIN (tags);

CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON collaboration.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE collaboration.article_revisions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  article_id UUID NOT NULL REFERENCES collaboration.articles (id) ON DELETE CASCADE,
  revision INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT article_revisions_unique UNIQUE (article_id, revision)
);

CREATE TABLE platform.automation_rules (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER automation_rules_set_updated_at
  BEFORE UPDATE ON platform.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE platform.automation_runs (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  rule_id UUID NOT NULL REFERENCES platform.automation_rules (id) ON DELETE CASCADE,
  event_id UUID,
  correlation_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT automation_runs_idempotency UNIQUE (rule_id, idempotency_key)
);

CREATE TABLE collaboration.report_definitions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  definition JSONB NOT NULL,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER report_definitions_set_updated_at
  BEFORE UPDATE ON collaboration.report_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE collaboration.report_snapshots (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  report_definition_id UUID NOT NULL REFERENCES collaboration.report_definitions (id) ON DELETE CASCADE,
  as_of TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collaboration.meeting_notes (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  project_id UUID REFERENCES planning.projects (id),
  title TEXT NOT NULL,
  agenda TEXT NOT NULL DEFAULT '',
  minutes TEXT NOT NULL DEFAULT '',
  held_at TIMESTAMPTZ,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER meeting_notes_set_updated_at
  BEFORE UPDATE ON collaboration.meeting_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
