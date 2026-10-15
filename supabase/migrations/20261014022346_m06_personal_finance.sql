-- M06: Personal finance — balanced posting ledger
-- Money convention: NUMERIC(20,6) + ISO currency (ADR)

CREATE TABLE finance_personal.personal_finance_books (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  personal_space_id UUID NOT NULL UNIQUE REFERENCES identity.personal_spaces (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Personal',
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER personal_finance_books_set_updated_at
  BEFORE UPDATE ON finance_personal.personal_finance_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.finance_accounts (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES finance_personal.finance_accounts (id),
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  subtype public.finance_account_subtype NOT NULL DEFAULT 'other_asset',
  institution TEXT,
  currency CHAR(3) NOT NULL,
  status public.record_status NOT NULL DEFAULT 'active',
  opening_balance NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_accounts_name_unique UNIQUE (book_id, name)
);

CREATE TRIGGER finance_accounts_set_updated_at
  BEFORE UPDATE ON finance_personal.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.finance_categories (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES finance_personal.finance_categories (id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT finance_categories_unique UNIQUE (book_id, name, kind)
);

CREATE TABLE finance_personal.merchants (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT merchants_unique UNIQUE (book_id, name)
);

CREATE TABLE finance_personal.financial_journals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  posted_at TIMESTAMPTZ,
  state public.journal_state NOT NULL DEFAULT 'draft',
  payee TEXT,
  memo TEXT NOT NULL DEFAULT '',
  source_id TEXT,
  reverses_journal_id UUID REFERENCES finance_personal.financial_journals (id),
  correlation_id UUID,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX financial_journals_book_date_idx
  ON finance_personal.financial_journals (book_id, event_date DESC);

CREATE TRIGGER financial_journals_set_updated_at
  BEFORE UPDATE ON finance_personal.financial_journals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.financial_postings (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  journal_id UUID NOT NULL REFERENCES finance_personal.financial_journals (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance_personal.finance_accounts (id),
  direction public.posting_direction NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  category_id UUID REFERENCES finance_personal.finance_categories (id),
  clearing_state TEXT NOT NULL DEFAULT 'uncleared',
  dimension_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX financial_postings_account_idx ON finance_personal.financial_postings (account_id);
CREATE INDEX financial_postings_journal_idx ON finance_personal.financial_postings (journal_id);

-- Enforce balanced posted journals (per currency)
CREATE OR REPLACE FUNCTION finance_personal.assert_journal_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  j_state public.journal_state;
  unbalanced INT;
BEGIN
  SELECT state INTO j_state FROM finance_personal.financial_journals WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);

  IF j_state = 'posted' THEN
    SELECT COUNT(*) INTO unbalanced
    FROM (
      SELECT currency,
             SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS debits,
             SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS credits
      FROM finance_personal.financial_postings
      WHERE journal_id = COALESCE(NEW.journal_id, OLD.journal_id)
      GROUP BY currency
      HAVING SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)
          <> SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)
    ) x;

    IF unbalanced > 0 THEN
      RAISE EXCEPTION 'Posted journal must balance per currency';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER financial_postings_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON finance_personal.financial_postings
  FOR EACH ROW EXECUTE FUNCTION finance_personal.assert_journal_balanced();

CREATE OR REPLACE FUNCTION finance_personal.assert_journal_state_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  unbalanced INT;
  posting_count INT;
BEGIN
  IF NEW.state = 'posted' AND (OLD.state IS DISTINCT FROM 'posted') THEN
    SELECT COUNT(*) INTO posting_count
    FROM finance_personal.financial_postings WHERE journal_id = NEW.id;

    IF posting_count < 2 THEN
      RAISE EXCEPTION 'Posted journal requires at least two postings';
    END IF;

    SELECT COUNT(*) INTO unbalanced
    FROM (
      SELECT currency
      FROM finance_personal.financial_postings
      WHERE journal_id = NEW.id
      GROUP BY currency
      HAVING SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)
          <> SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)
    ) x;

    IF unbalanced > 0 THEN
      RAISE EXCEPTION 'Cannot post unbalanced journal';
    END IF;

    NEW.posted_at := COALESCE(NEW.posted_at, now());
  END IF;

  -- Immutability of posted journals (header fields)
  IF OLD.state = 'posted' AND NEW.state = 'posted' THEN
    IF NEW.event_date IS DISTINCT FROM OLD.event_date
       OR NEW.payee IS DISTINCT FROM OLD.payee
       OR NEW.memo IS DISTINCT FROM OLD.memo THEN
      RAISE EXCEPTION 'Posted journal header is immutable; use reversal';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_journals_post_guard
  BEFORE UPDATE ON finance_personal.financial_journals
  FOR EACH ROW EXECUTE FUNCTION finance_personal.assert_journal_state_balance();

CREATE TABLE finance_personal.transaction_tags (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  CONSTRAINT transaction_tags_unique UNIQUE (book_id, name)
);

CREATE TABLE finance_personal.journal_tag_links (
  journal_id UUID NOT NULL REFERENCES finance_personal.financial_journals (id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES finance_personal.transaction_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (journal_id, tag_id)
);

CREATE TABLE finance_personal.budget_plans (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly',
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER budget_plans_set_updated_at
  BEFORE UPDATE ON finance_personal.budget_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.budget_periods (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  budget_plan_id UUID NOT NULL REFERENCES finance_personal.budget_plans (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  CONSTRAINT budget_periods_range CHECK (period_end >= period_start),
  CONSTRAINT budget_periods_unique UNIQUE (budget_plan_id, period_start)
);

CREATE TABLE finance_personal.budget_allocations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  budget_period_id UUID NOT NULL REFERENCES finance_personal.budget_periods (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES finance_personal.finance_categories (id),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL,
  CONSTRAINT budget_allocations_unique UNIQUE (budget_period_id, category_id)
);

CREATE TABLE finance_personal.savings_targets (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(20, 6) NOT NULL CHECK (target_amount > 0),
  currency CHAR(3) NOT NULL,
  linked_account_id UUID REFERENCES finance_personal.finance_accounts (id),
  linked_goal_id UUID REFERENCES personal.goals (id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER savings_targets_set_updated_at
  BEFORE UPDATE ON finance_personal.savings_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.recurring_rules (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  recurrence_rule TEXT NOT NULL,
  template JSONB NOT NULL,
  next_occurrence DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER recurring_rules_set_updated_at
  BEFORE UPDATE ON finance_personal.recurring_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.scheduled_financial_occurrences (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  rule_id UUID NOT NULL REFERENCES finance_personal.recurring_rules (id) ON DELETE CASCADE,
  occurrence_key TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  journal_id UUID REFERENCES finance_personal.financial_journals (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_financial_occurrences_unique UNIQUE (rule_id, occurrence_key)
);

CREATE TABLE finance_personal.import_rows (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  batch_id UUID NOT NULL REFERENCES platform.import_batches (id) ON DELETE CASCADE,
  row_fingerprint TEXT NOT NULL,
  raw JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged',
  journal_id UUID REFERENCES finance_personal.financial_journals (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_rows_fingerprint_unique UNIQUE (batch_id, row_fingerprint)
);

CREATE TABLE finance_personal.statement_reconciliations (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  account_id UUID NOT NULL REFERENCES finance_personal.finance_accounts (id),
  statement_date DATE NOT NULL,
  statement_balance NUMERIC(20, 6) NOT NULL,
  cleared_balance NUMERIC(20, 6),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER statement_reconciliations_set_updated_at
  BEFORE UPDATE ON finance_personal.statement_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_personal.fx_rates (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
  observed_on DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_unique UNIQUE (base_currency, quote_currency, observed_on, source)
);

CREATE TABLE finance_personal.valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_personal.personal_finance_books (id) ON DELETE CASCADE,
  as_of DATE NOT NULL,
  currency CHAR(3) NOT NULL,
  net_worth NUMERIC(20, 6) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valuation_snapshots_unique UNIQUE (book_id, as_of, currency)
);
