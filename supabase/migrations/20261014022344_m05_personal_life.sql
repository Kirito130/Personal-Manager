-- M05: Personal life — goals, habits, journal, notes

CREATE TABLE personal.life_areas (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT life_areas_name_unique UNIQUE (personal_space_id, name)
);

CREATE TRIGGER life_areas_set_updated_at
  BEFORE UPDATE ON personal.life_areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.goals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL DEFAULT 'PERSONAL',
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  area_id UUID REFERENCES personal.life_areas (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  metric_type TEXT NOT NULL DEFAULT 'percent',
  baseline NUMERIC(20, 6) NOT NULL DEFAULT 0,
  target NUMERIC(20, 6) NOT NULL DEFAULT 100,
  current_value NUMERIC(20, 6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '%',
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active',
  starts_on DATE,
  due_on DATE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT goals_personal_scope CHECK (
    scope_type = 'PERSONAL' OR scope_type = 'ORGANIZATION'
  )
);

CREATE INDEX goals_scope_idx ON personal.goals (scope_type, scope_id);

CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON personal.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.goal_milestones (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  goal_id UUID NOT NULL REFERENCES personal.goals (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target NUMERIC(20, 6),
  weight NUMERIC(8, 4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open',
  position INT NOT NULL DEFAULT 0,
  due_on DATE,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER goal_milestones_set_updated_at
  BEFORE UPDATE ON personal.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.goal_checkins (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  goal_id UUID NOT NULL REFERENCES personal.goals (id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  value NUMERIC(20, 6) NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  actor_id UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX goal_checkins_goal_date_idx ON personal.goal_checkins (goal_id, checkin_date DESC);

CREATE TABLE personal.habits (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  schedule_rule TEXT NOT NULL DEFAULT 'FREQ=DAILY',
  target_count INT NOT NULL DEFAULT 1 CHECK (target_count > 0),
  unit TEXT NOT NULL DEFAULT 'times',
  rollover_policy TEXT NOT NULL DEFAULT 'none',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER habits_set_updated_at
  BEFORE UPDATE ON personal.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.habit_checkins (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  habit_id UUID NOT NULL REFERENCES personal.habits (id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 1 CHECK (count >= 0),
  note TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT habit_checkins_unique UNIQUE (habit_id, local_date)
);

CREATE TABLE personal.journal_entries (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  privacy_mode TEXT NOT NULL DEFAULT 'private',
  mood TEXT,
  content_ref TEXT,
  body TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_date_unique UNIQUE (personal_space_id, local_date)
);

CREATE TRIGGER journal_entries_set_updated_at
  BEFORE UPDATE ON personal.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.journal_revisions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  journal_entry_id UUID NOT NULL REFERENCES personal.journal_entries (id) ON DELETE CASCADE,
  revision INT NOT NULL,
  body TEXT NOT NULL,
  content_ref TEXT,
  author_id UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_revisions_unique UNIQUE (journal_entry_id, revision)
);

CREATE TABLE personal.notes (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  scope_type public.scope_type NOT NULL,
  scope_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES identity.profiles (id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  body_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_scope_idx ON personal.notes (scope_type, scope_id);
CREATE INDEX notes_tags_idx ON personal.notes USING GIN (tags);

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON personal.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE personal.note_revisions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  note_id UUID NOT NULL REFERENCES personal.notes (id) ON DELETE CASCADE,
  revision INT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT note_revisions_unique UNIQUE (note_id, revision)
);

CREATE TABLE personal.review_templates (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly',
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal.reviews (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  template_id UUID REFERENCES personal.review_templates (id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON personal.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
