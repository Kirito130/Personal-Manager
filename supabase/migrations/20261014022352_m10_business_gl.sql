-- M10: Business general ledger (separate from personal books)

CREATE TABLE finance_business.business_books (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  organization_id UUID NOT NULL UNIQUE REFERENCES identity.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Business',
  base_currency CHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER business_books_set_updated_at
  BEFORE UPDATE ON finance_business.business_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.business_accounts (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_business.business_books (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES finance_business.business_accounts (id),
  code TEXT,
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  currency CHAR(3) NOT NULL,
  status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_accounts_name_unique UNIQUE (book_id, name)
);

CREATE TRIGGER business_accounts_set_updated_at
  BEFORE UPDATE ON finance_business.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.business_periods (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_business.business_books (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  CONSTRAINT business_periods_range CHECK (period_end >= period_start),
  CONSTRAINT business_periods_unique UNIQUE (book_id, period_start)
);

CREATE TABLE finance_business.business_journals (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  book_id UUID NOT NULL REFERENCES finance_business.business_books (id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  posted_at TIMESTAMPTZ,
  state public.journal_state NOT NULL DEFAULT 'draft',
  memo TEXT NOT NULL DEFAULT '',
  source_kind TEXT,
  source_id UUID,
  reverses_journal_id UUID REFERENCES finance_business.business_journals (id),
  correlation_id UUID,
  created_by UUID REFERENCES identity.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX business_journals_source_unique
  ON finance_business.business_journals (book_id, source_kind, source_id)
  WHERE source_kind IS NOT NULL AND source_id IS NOT NULL AND state <> 'reversed';

CREATE TRIGGER business_journals_set_updated_at
  BEFORE UPDATE ON finance_business.business_journals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE finance_business.business_postings (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  journal_id UUID NOT NULL REFERENCES finance_business.business_journals (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES finance_business.business_accounts (id),
  direction public.posting_direction NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION finance_business.assert_business_journal_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  j_state public.journal_state;
  unbalanced INT;
BEGIN
  SELECT state INTO j_state
  FROM finance_business.business_journals
  WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);

  IF j_state = 'posted' THEN
    SELECT COUNT(*) INTO unbalanced
    FROM (
      SELECT currency
      FROM finance_business.business_postings
      WHERE journal_id = COALESCE(NEW.journal_id, OLD.journal_id)
      GROUP BY currency
      HAVING SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)
          <> SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)
    ) x;

    IF unbalanced > 0 THEN
      RAISE EXCEPTION 'Posted business journal must balance per currency';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER business_postings_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON finance_business.business_postings
  FOR EACH ROW EXECUTE FUNCTION finance_business.assert_business_journal_balanced();

CREATE OR REPLACE FUNCTION finance_business.assert_business_journal_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  unbalanced INT;
  posting_count INT;
BEGIN
  IF NEW.state = 'posted' AND (OLD.state IS DISTINCT FROM 'posted') THEN
    SELECT COUNT(*) INTO posting_count
    FROM finance_business.business_postings WHERE journal_id = NEW.id;

    IF posting_count < 2 THEN
      RAISE EXCEPTION 'Posted business journal requires at least two postings';
    END IF;

    SELECT COUNT(*) INTO unbalanced
    FROM (
      SELECT currency
      FROM finance_business.business_postings
      WHERE journal_id = NEW.id
      GROUP BY currency
      HAVING SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END)
          <> SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END)
    ) x;

    IF unbalanced > 0 THEN
      RAISE EXCEPTION 'Cannot post unbalanced business journal';
    END IF;

    NEW.posted_at := COALESCE(NEW.posted_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER business_journals_post_guard
  BEFORE UPDATE ON finance_business.business_journals
  FOR EACH ROW EXECUTE FUNCTION finance_business.assert_business_journal_post();
