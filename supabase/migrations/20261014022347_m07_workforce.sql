-- M07: Workforce — people, time, attendance, capacity (distinct from focus)

CREATE TABLE workforce.people_resources (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  user_id UUID REFERENCES identity.profiles (id),
  display_name TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'employee',
  starts_on DATE,
  ends_on DATE,
  status public.record_status NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  utilization_goal_pct NUMERIC(5, 2) DEFAULT 80,
  manager_resource_id UUID REFERENCES workforce.people_resources (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX people_resources_org_idx ON workforce.people_resources (organization_id);

CREATE TRIGGER people_resources_set_updated_at
  BEFORE UPDATE ON workforce.people_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE workforce.resource_skills (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  CONSTRAINT resource_skills_unique UNIQUE (organization_id, name)
);

CREATE TABLE workforce.resource_skill_levels (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  resource_id UUID NOT NULL REFERENCES workforce.people_resources (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES workforce.resource_skills (id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  CONSTRAINT resource_skill_levels_unique UNIQUE (resource_id, skill_id)
);

CREATE TABLE workforce.work_calendars (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  weekly_hours NUMERIC(5, 2) NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workforce.work_calendar_exceptions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  calendar_id UUID NOT NULL REFERENCES workforce.work_calendars (id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'holiday',
  hours NUMERIC(5, 2) NOT NULL DEFAULT 0,
  CONSTRAINT work_calendar_exceptions_unique UNIQUE (calendar_id, exception_date)
);

CREATE TABLE workforce.leave_requests (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES workforce.people_resources (id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'pto',
  hours NUMERIC(6, 2),
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_range CHECK (ends_on >= starts_on)
);

CREATE TRIGGER leave_requests_set_updated_at
  BEFORE UPDATE ON workforce.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE workforce.leave_approvals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  leave_request_id UUID NOT NULL REFERENCES workforce.leave_requests (id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES identity.profiles (id),
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workforce.resource_allocations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES workforce.people_resources (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES planning.projects (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  hours_per_week NUMERIC(6, 2),
  allocation_pct NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resource_allocations_range CHECK (period_end >= period_start)
);

CREATE INDEX resource_allocations_resource_idx
  ON workforce.resource_allocations (resource_id, period_start, period_end);

CREATE TABLE workforce.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES workforce.people_resources (id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER attendance_sessions_set_updated_at
  BEFORE UPDATE ON workforce.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE workforce.attendance_breaks (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  attendance_session_id UUID NOT NULL REFERENCES workforce.attendance_sessions (id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  unpaid BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE workforce.time_entries (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.profiles (id),
  project_id UUID REFERENCES planning.projects (id),
  task_id UUID REFERENCES planning.tasks (id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes >= 0),
  description TEXT NOT NULL DEFAULT '',
  billable BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_range CHECK (ended_at >= started_at)
);

CREATE INDEX time_entries_user_idx ON workforce.time_entries (user_id, started_at DESC);
CREATE INDEX time_entries_project_idx ON workforce.time_entries (project_id);

CREATE TRIGGER time_entries_set_updated_at
  BEFORE UPDATE ON workforce.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE workforce.timesheets (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.profiles (id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  state public.timesheet_state NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timesheets_period UNIQUE (organization_id, user_id, period_start)
);

CREATE TRIGGER timesheets_set_updated_at
  BEFORE UPDATE ON workforce.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE workforce.timesheet_lines (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  timesheet_id UUID NOT NULL REFERENCES workforce.timesheets (id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES workforce.time_entries (id),
  CONSTRAINT timesheet_lines_entry_unique UNIQUE (time_entry_id)
);

CREATE TABLE workforce.timesheet_approvals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  timesheet_id UUID NOT NULL REFERENCES workforce.timesheets (id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES identity.profiles (id),
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billable units: unique billing linkage prevents double billing
CREATE TABLE workforce.billable_units (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('time_entry', 'expense', 'milestone', 'product')),
  source_id UUID NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'hour',
  unit_rate NUMERIC(20, 6),
  currency CHAR(3) NOT NULL,
  project_id UUID REFERENCES planning.projects (id),
  status TEXT NOT NULL DEFAULT 'available',
  billed_invoice_line_id UUID, -- set when invoiced
  rate_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billable_units_source_unique UNIQUE (organization_id, source_kind, source_id)
);

CREATE INDEX billable_units_available_idx
  ON workforce.billable_units (organization_id, status)
  WHERE status = 'available';

CREATE TABLE workforce.contract_rates (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  project_id UUID REFERENCES planning.projects (id),
  resource_id UUID REFERENCES workforce.people_resources (id),
  role_label TEXT,
  hourly_rate NUMERIC(20, 6) NOT NULL CHECK (hourly_rate >= 0),
  currency CHAR(3) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
