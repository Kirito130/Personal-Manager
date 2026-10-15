# ADR-0011: Dual finance books with owner-controlled correlations

## Status

Accepted

## Context

LifeOS keeps personal and business money domains separate (privacy, reporting semantics, permissions). The owner still needs automated links such as business salary/owner draw appearing as personal income.

## Decision

1. Maintain separate schemas/tables: `finance_personal.*` and `finance_business.*`.
2. Never join personal journals into organization reports or expose personal books to org members.
3. Use `finance_correlation_rules` + `finance_correlation_links` for owner-gated mappings.
4. Default mode is `CREATE_DRAFT` personal income journals; `AUTO_POST` is opt-in.
5. Enforce idempotency with `UNIQUE (source_kind, source_id, rule_id)`.
6. Money amounts use `NUMERIC(20,6)` + ISO currency codes (no IEEE floats).

## Consequences

- Salary → personal income is an explicit audited posting pair, not a shared ledger.
- Retries cannot double-create personal income for the same business source.
- NestJS worker applies rules after outbox events such as `owner_compensation.recorded`.
