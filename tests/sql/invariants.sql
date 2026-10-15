-- SQL invariant smoke tests (run against local Supabase after migrations)
-- Usage: psql "$DATABASE_URL" -f tests/sql/invariants.sql

BEGIN;

-- Invoice number uniqueness constraint exists
SELECT 1 / COUNT(*) FROM pg_constraint
WHERE conname = 'invoices_number_unique';

-- Billable unit source uniqueness
SELECT 1 / COUNT(*) FROM pg_constraint
WHERE conname = 'billable_units_source_unique';

-- Correlation idempotency
SELECT 1 / COUNT(*) FROM pg_constraint
WHERE conname = 'finance_correlation_links_unique';

-- Opportunity conversion uniqueness
SELECT 1 / COUNT(*) FROM pg_constraint
WHERE conname = 'opportunity_project_conversions_opp';

-- Schemas exist
SELECT 1 / COUNT(*) FROM information_schema.schemata WHERE schema_name = 'finance_personal';
SELECT 1 / COUNT(*) FROM information_schema.schemata WHERE schema_name = 'finance_business';

ROLLBACK;

SELECT 'invariant_checks_ok' AS result;
