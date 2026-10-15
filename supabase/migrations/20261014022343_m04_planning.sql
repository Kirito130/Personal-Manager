-- M04: Planning — projects, tasks, boards, calendar, focus

CREATE TABLE planning.projects (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  client_account_id UUID, -- FK added after CRM (M08)
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  planned_start DATE,
  planned_end DATE,
  progress_policy TEXT NOT NULL DEFAULT 'manual',
  progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_scope_idx ON planning.projects (scope_type, scope_id);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON planning.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.project_phases (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  project_id UUID NOT NULL REFERENCES planning.projects (id) ON DELETE CASCADE,
  parent_phase_id UUID REFERENCES planning.project_phases (id),
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER project_phases_set_updated_at
  BEFORE UPDATE ON planning.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.milestones (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  project_id UUID NOT NULL REFERENCES planning.projects (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  progress_policy TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER milestones_set_updated_at
  BEFORE UPDATE ON planning.milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.task_workflow_statuses (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  project_id UUID REFERENCES planning.projects (id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  category public.task_status_category NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_workflow_statuses_unique UNIQUE (scope_type, scope_id, project_id, key)
);

-- Canonical tasks
CREATE TABLE planning.tasks (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  project_id UUID REFERENCES planning.projects (id) ON DELETE SET NULL,
  phase_id UUID REFERENCES planning.project_phases (id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES planning.tasks (id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES planning.milestones (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status_key TEXT NOT NULL DEFAULT 'todo',
  status_category public.task_status_category NOT NULL DEFAULT 'NOT_STARTED',
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  task_type TEXT NOT NULL DEFAULT 'task',
  due_at TIMESTAMPTZ,
  start_at TIMESTAMPTZ,
  estimate_minutes INT CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
  completed_at TIMESTAMPTZ,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_scope_idx ON planning.tasks (scope_type, scope_id);
CREATE INDEX tasks_project_idx ON planning.tasks (project_id);
CREATE INDEX tasks_due_idx ON planning.tasks (due_at) WHERE completed_at IS NULL;
CREATE INDEX tasks_status_idx ON planning.tasks (status_category);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON planning.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.task_assignees (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'assignee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_assignees_unique UNIQUE (task_id, user_id)
);

CREATE TABLE planning.task_checklist_items (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER task_checklist_items_set_updated_at
  BEFORE UPDATE ON planning.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.task_dependencies (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  predecessor_task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_minutes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_dependencies_no_self CHECK (predecessor_task_id <> successor_task_id),
  CONSTRAINT task_dependencies_unique UNIQUE (predecessor_task_id, successor_task_id, kind)
);

CREATE TABLE planning.task_labels (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_labels_unique UNIQUE (scope_type, scope_id, name)
);

CREATE TABLE planning.task_label_links (
  task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES planning.task_labels (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE planning.task_recurrences (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  task_template_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  recurrence_rule TEXT NOT NULL,
  exception_dates DATE[] NOT NULL DEFAULT '{}',
  next_due TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER task_recurrences_set_updated_at
  BEFORE UPDATE ON planning.task_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.task_occurrences (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  template_id UUID NOT NULL REFERENCES planning.task_recurrences (id) ON DELETE CASCADE,
  occurrence_key TEXT NOT NULL,
  task_id UUID NOT NULL REFERENCES planning.tasks (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_occurrences_unique UNIQUE (template_id, occurrence_key)
);

CREATE TABLE planning.boards (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  project_id UUID REFERENCES planning.projects (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER boards_set_updated_at
  BEFORE UPDATE ON planning.boards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.board_columns (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  board_id UUID NOT NULL REFERENCES planning.boards (id) ON DELETE CASCADE,
  workflow_status_id UUID REFERENCES planning.task_workflow_statuses (id),
  name TEXT NOT NULL,
  status_category public.task_status_category NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planning.board_views (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  board_id UUID NOT NULL REFERENCES planning.boards (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planning.calendar_events (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  recurrence_rule TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_range CHECK (ends_at >= starts_at)
);

CREATE INDEX calendar_events_range_idx
  ON planning.calendar_events (scope_type, scope_id, starts_at, ends_at);

CREATE TRIGGER calendar_events_set_updated_at
  BEFORE UPDATE ON planning.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.event_exceptions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  parent_event_id UUID NOT NULL REFERENCES planning.calendar_events (id) ON DELETE CASCADE,
  recurrence_instance TIMESTAMPTZ NOT NULL,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  override_starts_at TIMESTAMPTZ,
  override_ends_at TIMESTAMPTZ,
  override_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_exceptions_unique UNIQUE (parent_event_id, recurrence_instance)
);

CREATE TABLE planning.time_blocks (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  task_id UUID REFERENCES planning.tasks (id) ON DELETE SET NULL,
  title TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_blocks_range CHECK (ends_at > starts_at)
);

CREATE INDEX time_blocks_owner_range_idx
  ON planning.time_blocks (owner_id, starts_at, ends_at);

CREATE TRIGGER time_blocks_set_updated_at
  BEFORE UPDATE ON planning.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.focus_sessions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  user_id UUID NOT NULL REFERENCES identity.profiles (id),
  task_id UUID REFERENCES planning.tasks (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  paused_seconds INT NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  status public.focus_session_status NOT NULL DEFAULT 'running',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX focus_sessions_user_active_idx
  ON planning.focus_sessions (user_id)
  WHERE status IN ('running', 'paused');

CREATE TRIGGER focus_sessions_set_updated_at
  BEFORE UPDATE ON planning.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE planning.focus_interruptions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  focus_session_id UUID NOT NULL REFERENCES planning.focus_sessions (id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT '',
  duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0)
);
