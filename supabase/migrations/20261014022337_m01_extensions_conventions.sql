-- M01: Extensions, schemas, shared enums, helper functions

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS planning;
CREATE SCHEMA IF NOT EXISTS personal;
CREATE SCHEMA IF NOT EXISTS workforce;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS finance_personal;
CREATE SCHEMA IF NOT EXISTS finance_business;
CREATE SCHEMA IF NOT EXISTS collaboration;

-- Shared enums
CREATE TYPE public.scope_type AS ENUM ('PERSONAL', 'ORGANIZATION');
CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended', 'removed');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'project_manager', 'member', 'finance', 'viewer');
CREATE TYPE public.record_status AS ENUM ('active', 'archived', 'deleted');

CREATE TYPE public.task_status_category AS ENUM (
  'NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'
);

CREATE TYPE public.journal_state AS ENUM ('draft', 'posted', 'reversed');
CREATE TYPE public.posting_direction AS ENUM ('debit', 'credit');

CREATE TYPE public.invoice_state AS ENUM (
  'draft', 'pending_approval', 'issued', 'partially_paid', 'paid', 'void', 'credited'
);

CREATE TYPE public.timesheet_state AS ENUM (
  'draft', 'submitted', 'approved', 'rejected', 'locked'
);

CREATE TYPE public.focus_session_status AS ENUM (
  'running', 'paused', 'finished', 'cancelled'
);

CREATE TYPE public.correlation_mode AS ENUM ('AUTO_POST', 'CREATE_DRAFT', 'SUGGEST_ONLY');
CREATE TYPE public.correlation_link_status AS ENUM (
  'pending', 'draft_created', 'posted', 'skipped', 'failed'
);

CREATE TYPE public.account_type AS ENUM (
  'asset', 'liability', 'equity', 'income', 'expense'
);

CREATE TYPE public.finance_account_subtype AS ENUM (
  'checking', 'savings', 'cash', 'credit_card', 'loan', 'investment',
  'receivable', 'payable', 'other_asset', 'other_liability',
  'income', 'expense', 'transfer_clearing'
);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- UUIDv7-ish: time-ordered UUID (use gen_random_uuid until native uuidv7 widely available)
-- Qualify extensions.gen_random_bytes — local Supabase installs pgcrypto in extensions,
-- not public; auth signup triggers call this with a narrow search_path.
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  unix_ts_ms BYTEA;
  uuid_bytes BYTEA;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes := unix_ts_ms || extensions.gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112); -- version 7
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128); -- variant
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

COMMENT ON FUNCTION public.uuid_generate_v7() IS 'Time-ordered UUIDv7 for LifeOS primary keys';
