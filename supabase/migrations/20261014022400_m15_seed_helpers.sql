-- M15: Seed helpers (synthetic data functions — no real PII)
-- Actual demo rows are created after auth users exist (see supabase/seed.sql)

CREATE OR REPLACE FUNCTION identity.ensure_personal_finance_book(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = identity, finance_personal, public
AS $$
DECLARE
  space_id UUID;
  book_id UUID;
  checking_id UUID;
  income_id UUID;
  expense_cat UUID;
  income_cat UUID;
BEGIN
  SELECT id INTO space_id FROM identity.personal_spaces WHERE owner_user_id = p_user_id;
  IF space_id IS NULL THEN
    RAISE EXCEPTION 'Personal space not found for user';
  END IF;

  SELECT id INTO book_id FROM finance_personal.personal_finance_books WHERE personal_space_id = space_id;
  IF book_id IS NULL THEN
    INSERT INTO finance_personal.personal_finance_books (personal_space_id, name, base_currency)
    VALUES (space_id, 'Personal', 'USD')
    RETURNING id INTO book_id;

    INSERT INTO finance_personal.finance_accounts (book_id, name, account_type, subtype, currency)
    VALUES (book_id, 'Checking', 'asset', 'checking', 'USD')
    RETURNING id INTO checking_id;

    INSERT INTO finance_personal.finance_accounts (book_id, name, account_type, subtype, currency)
    VALUES (book_id, 'Salary Income', 'income', 'income', 'USD')
    RETURNING id INTO income_id;

    INSERT INTO finance_personal.finance_accounts (book_id, name, account_type, subtype, currency)
    VALUES (book_id, 'Expenses', 'expense', 'expense', 'USD');

    INSERT INTO finance_personal.finance_categories (book_id, name, kind)
    VALUES (book_id, 'Salary', 'income')
    RETURNING id INTO income_cat;

    INSERT INTO finance_personal.finance_categories (book_id, name, kind)
    VALUES (book_id, 'General', 'expense')
    RETURNING id INTO expense_cat;
  END IF;

  RETURN book_id;
END;
$$;

CREATE OR REPLACE FUNCTION identity.bootstrap_organization(
  p_owner_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_currency CHAR(3) DEFAULT 'USD'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = identity, finance_business, crm, public
AS $$
DECLARE
  org_id UUID;
  book_id UUID;
BEGIN
  INSERT INTO identity.organizations (name, slug, base_currency, owner_user_id)
  VALUES (p_name, p_slug, p_currency, p_owner_id)
  RETURNING id INTO org_id;

  INSERT INTO identity.memberships (organization_id, user_id, role, status)
  VALUES (org_id, p_owner_id, 'owner', 'active');

  INSERT INTO finance_business.business_books (organization_id, name, base_currency)
  VALUES (org_id, 'Business', p_currency)
  RETURNING id INTO book_id;

  INSERT INTO finance_business.invoice_number_series (organization_id, series_key, prefix, next_number)
  VALUES (org_id, 'default', 'INV-', 1);

  INSERT INTO crm.crm_stages (organization_id, pipeline_key, name, sort_order, win_probability, is_won, is_lost)
  VALUES
    (org_id, 'default', 'Qualified', 1, 10, false, false),
    (org_id, 'default', 'Proposal', 2, 40, false, false),
    (org_id, 'default', 'Negotiation', 3, 70, false, false),
    (org_id, 'default', 'Won', 4, 100, true, false),
    (org_id, 'default', 'Lost', 5, 0, false, true);

  RETURN org_id;
END;
$$;

COMMENT ON FUNCTION identity.ensure_personal_finance_book IS 'Creates default personal ledger accounts/categories for a user';
COMMENT ON FUNCTION identity.bootstrap_organization IS 'Creates org, owner membership, business book, invoice series, CRM stages';
