-- M09: Business commercial finance — quotes, invoices, payments, expenses

CREATE TABLE finance_business.products_services (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'hour',
  unit_price NUMERIC(20, 6) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  tax_code TEXT,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER products_services_set_updated_at
  BEFORE UPDATE ON finance_business.products_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.price_books (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finance_business.quotes (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES crm.crm_accounts (id),
  opportunity_id UUID REFERENCES crm.crm_opportunities (id),
  quote_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  currency CHAR(3) NOT NULL,
  subtotal NUMERIC(20, 6) NOT NULL DEFAULT 0,
  tax_total NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total NUMERIC(20, 6) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON finance_business.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.quote_lines (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  quote_id UUID NOT NULL REFERENCES finance_business.quotes (id) ON DELETE CASCADE,
  product_id UUID REFERENCES finance_business.products_services (id),
  description TEXT NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20, 6) NOT NULL,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(20, 6) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE finance_business.quote_acceptances (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  quote_id UUID NOT NULL UNIQUE REFERENCES finance_business.quotes (id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_by_name TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE finance_business.invoice_number_series (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  series_key TEXT NOT NULL DEFAULT 'default',
  prefix TEXT NOT NULL DEFAULT 'INV-',
  next_number BIGINT NOT NULL DEFAULT 1 CHECK (next_number > 0),
  padding INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_number_series_unique UNIQUE (organization_id, series_key)
);

CREATE TABLE finance_business.invoices (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES crm.crm_accounts (id),
  project_id UUID REFERENCES planning.projects (id),
  series_id UUID NOT NULL REFERENCES finance_business.invoice_number_series (id),
  invoice_number TEXT,
  state public.invoice_state NOT NULL DEFAULT 'draft',
  currency CHAR(3) NOT NULL,
  issue_date DATE,
  due_date DATE,
  subtotal NUMERIC(20, 6) NOT NULL DEFAULT 0,
  tax_total NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total NUMERIC(20, 6) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(20, 6) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  issued_at TIMESTAMPTZ,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_number_unique UNIQUE (organization_id, series_id, invoice_number)
);

CREATE INDEX invoices_org_state_idx ON finance_business.invoices (organization_id, state);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON finance_business.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.invoice_lines (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  invoice_id UUID NOT NULL REFERENCES finance_business.invoices (id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(20, 6) NOT NULL,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(20, 6) NOT NULL,
  billable_unit_id UUID REFERENCES workforce.billable_units (id),
  sort_order INT NOT NULL DEFAULT 0
);

-- Prevent double-billing same billable unit
CREATE UNIQUE INDEX invoice_lines_billable_unit_unique
  ON finance_business.invoice_lines (billable_unit_id)
  WHERE billable_unit_id IS NOT NULL;

CREATE TABLE finance_business.invoice_snapshots (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  invoice_id UUID NOT NULL UNIQUE REFERENCES finance_business.invoices (id),
  snapshot JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finance_business.invoice_deliveries (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  invoice_id UUID NOT NULL REFERENCES finance_business.invoices (id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'queued',
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_deliveries_idempotency UNIQUE (invoice_id, channel, idempotency_key)
);

CREATE TABLE finance_business.credit_notes (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES finance_business.invoices (id),
  credit_number TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_notes_unique UNIQUE (organization_id, credit_number)
);

CREATE TABLE finance_business.customer_payments (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES crm.crm_accounts (id),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  received_on DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'transfer',
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  idempotency_key TEXT,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_payments_idempotency UNIQUE (organization_id, idempotency_key)
);

CREATE TRIGGER customer_payments_set_updated_at
  BEFORE UPDATE ON finance_business.customer_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.payment_allocations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  payment_id UUID NOT NULL REFERENCES finance_business.customer_payments (id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES finance_business.invoices (id),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_allocations_unique UNIQUE (payment_id, invoice_id)
);

CREATE TABLE finance_business.vendors (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendors_name_unique UNIQUE (organization_id, name)
);

CREATE TRIGGER vendors_set_updated_at
  BEFORE UPDATE ON finance_business.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.business_expenses (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES finance_business.vendors (id),
  project_id UUID REFERENCES planning.projects (id),
  expense_date DATE NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  reimbursable BOOLEAN NOT NULL DEFAULT false,
  billable BOOLEAN NOT NULL DEFAULT false,
  is_owner_compensation BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  paid_status TEXT NOT NULL DEFAULT 'unpaid',
  receipt_attachment_id UUID REFERENCES platform.attachments (id),
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_expenses_org_idx ON finance_business.business_expenses (organization_id, expense_date DESC);
CREATE INDEX business_expenses_compensation_idx
  ON finance_business.business_expenses (organization_id)
  WHERE is_owner_compensation = true;

CREATE TRIGGER business_expenses_set_updated_at
  BEFORE UPDATE ON finance_business.business_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.expense_approvals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  expense_id UUID NOT NULL REFERENCES finance_business.business_expenses (id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES identity.profiles (id),
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finance_business.owner_compensations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES identity.profiles (id),
  expense_id UUID REFERENCES finance_business.business_expenses (id),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  compensation_date DATE NOT NULL,
  compensation_kind TEXT NOT NULL DEFAULT 'salary',
  status TEXT NOT NULL DEFAULT 'recorded',
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER owner_compensations_set_updated_at
  BEFORE UPDATE ON finance_business.owner_compensations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.project_budget_versions (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  project_id UUID NOT NULL REFERENCES planning.projects (id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finance_business.project_budget_lines (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  budget_version_id UUID NOT NULL REFERENCES finance_business.project_budget_versions (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  allocated_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL
);

CREATE TABLE finance_business.cost_entries (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES planning.projects (id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_id UUID NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL,
  cost_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cost_entries_source_unique UNIQUE (organization_id, source_kind, source_id)
);

-- Atomic invoice number reservation
CREATE OR REPLACE FUNCTION finance_business.reserve_invoice_number(p_series_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  s finance_business.invoice_number_series%ROWTYPE;
  num TEXT;
BEGIN
  SELECT * INTO s
  FROM finance_business.invoice_number_series
  WHERE id = p_series_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice series not found';
  END IF;

  num := s.prefix || lpad(s.next_number::text, s.padding, '0');

  UPDATE finance_business.invoice_number_series
  SET next_number = next_number + 1
  WHERE id = p_series_id;

  RETURN num;
END;
$$;
