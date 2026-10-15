-- M02: Identity & tenancy

-- Profiles linked 1:1 to auth.users
CREATE TABLE identity.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en-US',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_normalized UNIQUE (email)
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON identity.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Personal space: never joinable as an org
CREATE TABLE identity.personal_spaces (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES identity.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER personal_spaces_set_updated_at
  BEFORE UPDATE ON identity.personal_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE identity.organizations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  owner_user_id UUID NOT NULL REFERENCES identity.profiles (id),
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON identity.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE identity.memberships (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_org_user_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX memberships_user_idx ON identity.memberships (user_id);
CREATE INDEX memberships_org_active_idx ON identity.memberships (organization_id)
  WHERE status = 'active';

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON identity.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE identity.teams (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teams_org_name_unique UNIQUE (organization_id, name)
);

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON identity.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE identity.team_memberships (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  team_id UUID NOT NULL REFERENCES identity.teams (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_memberships_unique UNIQUE (team_id, user_id)
);

CREATE TABLE identity.permissions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity.role_grants (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  role public.org_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES identity.permissions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_grants_unique UNIQUE (role, permission_id)
);

CREATE TABLE identity.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES identity.profiles (id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workspace_invitations_org_email_idx
  ON identity.workspace_invitations (organization_id, email);

-- Bootstrap profile + personal space on signup
CREATE OR REPLACE FUNCTION identity.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = identity, public, extensions
AS $$
BEGIN
  INSERT INTO identity.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO identity.personal_spaces (owner_user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION identity.handle_new_user();

-- Helper: active org membership
CREATE OR REPLACE FUNCTION identity.is_org_member(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = identity, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION identity.owns_personal_space(p_space_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = identity, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.personal_spaces ps
    WHERE ps.id = p_space_id AND ps.owner_user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION identity.has_org_role(
  p_org_id UUID,
  p_roles public.org_role[],
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = identity, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM identity.memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;

-- Seed default permissions
INSERT INTO identity.permissions (key, description) VALUES
  ('org.manage', 'Manage organization settings'),
  ('org.invite', 'Invite members'),
  ('project.manage', 'Create and manage projects'),
  ('task.edit', 'Edit tasks'),
  ('time.approve', 'Approve timesheets'),
  ('finance.manage', 'Manage business finance'),
  ('finance.view', 'View business finance'),
  ('crm.manage', 'Manage CRM'),
  ('report.view', 'View reports');
