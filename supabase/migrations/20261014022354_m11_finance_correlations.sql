-- M11: Cross-book finance correlations (owner-controlled; books stay separate)

CREATE TABLE finance_business.finance_correlation_rules (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  owner_user_id UUID NOT NULL REFERENCES identity.profiles (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES identity.organizations (id) ON DELETE CASCADE,
  target_personal_book_id UUID NOT NULL
    REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  -- e.g. owner_compensation.recorded | business_expense.approved (salary)
  source_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- maps to personal income account + category
  target_income_account_id UUID NOT NULL
    REFERENCES finance_personal.finance_accounts (id),
  target_category_id UUID REFERENCES finance_personal.finance_categories (id),
  mode public.correlation_mode NOT NULL DEFAULT 'CREATE_DRAFT',
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finance_correlation_rules_owner_idx
  ON finance_business.finance_correlation_rules (owner_user_id)
  WHERE enabled = true;

CREATE INDEX finance_correlation_rules_org_event_idx
  ON finance_business.finance_correlation_rules (organization_id, trigger_event)
  WHERE enabled = true;

CREATE TRIGGER finance_correlation_rules_set_updated_at
  BEFORE UPDATE ON finance_business.finance_correlation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure target book belongs to the rule owner
CREATE OR REPLACE FUNCTION finance_business.assert_correlation_rule_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  book_owner UUID;
  account_book UUID;
BEGIN
  SELECT ps.owner_user_id INTO book_owner
  FROM finance_personal.personal_finance_books b
  JOIN identity.personal_spaces ps ON ps.id = b.personal_space_id
  WHERE b.id = NEW.target_personal_book_id;

  IF book_owner IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'Correlation rule target book must belong to owner';
  END IF;

  SELECT book_id INTO account_book
  FROM finance_personal.finance_accounts
  WHERE id = NEW.target_income_account_id;

  IF account_book IS DISTINCT FROM NEW.target_personal_book_id THEN
    RAISE EXCEPTION 'Target income account must belong to target personal book';
  END IF;

  IF NOT identity.is_org_member(NEW.organization_id, NEW.owner_user_id) THEN
    RAISE EXCEPTION 'Owner must be an active member of the source organization';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER finance_correlation_rules_owner_guard
  BEFORE INSERT OR UPDATE ON finance_business.finance_correlation_rules
  FOR EACH ROW EXECUTE FUNCTION finance_business.assert_correlation_rule_owner();

CREATE TABLE finance_business.finance_correlation_links (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  rule_id UUID NOT NULL REFERENCES finance_business.finance_correlation_rules (id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_journal_id UUID REFERENCES finance_personal.financial_journals (id),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status public.correlation_link_status NOT NULL DEFAULT 'pending',
  correlation_id UUID NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Retries never double-post personal income for the same source+rule
  CONSTRAINT finance_correlation_links_unique UNIQUE (source_kind, source_id, rule_id)
);

CREATE INDEX finance_correlation_links_status_idx
  ON finance_business.finance_correlation_links (status);

CREATE TRIGGER finance_correlation_links_set_updated_at
  BEFORE UPDATE ON finance_business.finance_correlation_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE finance_business.finance_correlation_rules IS
  'Owner-gated rules that create personal income journals from business events without merging ledgers';
COMMENT ON TABLE finance_business.finance_correlation_links IS
  'Idempotent link between a business source record and a personal finance journal';
