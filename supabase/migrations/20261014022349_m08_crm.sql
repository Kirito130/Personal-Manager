-- M08: CRM

CREATE TABLE crm.crm_accounts (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'customer',
  website TEXT,
  industry TEXT,
  owner_id UUID REFERENCES identity.profiles (id),
  parent_account_id UUID REFERENCES crm.crm_accounts (id),
  status public.record_status NOT NULL DEFAULT 'active',
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_accounts_org_idx ON crm.crm_accounts (organization_id);
CREATE INDEX crm_accounts_name_trgm ON crm.crm_accounts USING GIN (name gin_trgm_ops);

CREATE TRIGGER crm_accounts_set_updated_at
  BEFORE UPDATE ON crm.crm_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link projects to CRM customers
ALTER TABLE planning.projects
  ADD CONSTRAINT projects_client_account_fk
  FOREIGN KEY (client_account_id) REFERENCES crm.crm_accounts (id);

CREATE TABLE crm.crm_contacts (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm.crm_accounts (id) ON DELETE SET NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  title TEXT,
  owner_id UUID REFERENCES identity.profiles (id),
  communication_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_contacts_org_idx ON crm.crm_contacts (organization_id);
CREATE INDEX crm_contacts_email_idx ON crm.crm_contacts (organization_id, email);

CREATE TRIGGER crm_contacts_set_updated_at
  BEFORE UPDATE ON crm.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE crm.crm_stages (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  pipeline_key TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  win_probability NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT crm_stages_unique UNIQUE (organization_id, pipeline_key, name)
);

CREATE TABLE crm.crm_leads (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  owner_id UUID REFERENCES identity.profiles (id),
  converted_account_id UUID REFERENCES crm.crm_accounts (id),
  converted_opportunity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_leads_set_updated_at
  BEFORE UPDATE ON crm.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE crm.crm_opportunities (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES crm.crm_accounts (id),
  stage_id UUID REFERENCES crm.crm_stages (id),
  name TEXT NOT NULL,
  expected_value NUMERIC(20, 6),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  win_probability NUMERIC(5, 2),
  close_date DATE,
  owner_id UUID REFERENCES identity.profiles (id),
  status TEXT NOT NULL DEFAULT 'open',
  next_action TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crm_opportunities_org_idx ON crm.crm_opportunities (organization_id);

CREATE TRIGGER crm_opportunities_set_updated_at
  BEFORE UPDATE ON crm.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE crm.crm_leads
  ADD CONSTRAINT crm_leads_converted_opp_fk
  FOREIGN KEY (converted_opportunity_id) REFERENCES crm.crm_opportunities (id);

CREATE TABLE crm.crm_stage_history (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  opportunity_id UUID NOT NULL REFERENCES crm.crm_opportunities (id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES crm.crm_stages (id),
  to_stage_id UUID REFERENCES crm.crm_stages (id),
  changed_by UUID REFERENCES identity.profiles (id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crm.crm_activities (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm.crm_accounts (id),
  contact_id UUID REFERENCES crm.crm_contacts (id),
  opportunity_id UUID REFERENCES crm.crm_opportunities (id),
  lead_id UUID REFERENCES crm.crm_leads (id),
  activity_type TEXT NOT NULL DEFAULT 'note',
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  owner_id UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER crm_activities_set_updated_at
  BEFORE UPDATE ON crm.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Idempotent opportunity → project conversion
CREATE TABLE crm.opportunity_project_conversions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES crm.crm_opportunities (id),
  project_id UUID NOT NULL REFERENCES planning.projects (id),
  conversion_key TEXT NOT NULL,
  converted_by UUID NOT NULL REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_project_conversions_opp UNIQUE (opportunity_id),
  CONSTRAINT opportunity_project_conversions_key UNIQUE (organization_id, conversion_key)
);
