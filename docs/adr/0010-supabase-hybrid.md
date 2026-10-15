# ADR-0010: Supabase hybrid architecture

## Status

Accepted

## Context

LifeOS (`project.md`) specifies a NestJS modular monolith with PostgreSQL, object storage, and a job worker. The product owner requires maximizing Supabase for the data plane while keeping NestJS domain services for invariants (finance, invoicing, authorization).

## Decision

- **Postgres, Auth, Storage, Realtime:** Supabase
- **Domain API / workers:** NestJS (`apps/api`, `apps/worker`) validating Supabase JWTs and enforcing policy in application services
- **ORM:** Drizzle, with schema ownership in Supabase SQL migrations
- **Queue:** Postgres transactional outbox + NestJS worker (no Redis required for MVP)
- **RLS:** Enabled on all domain tables as defense in depth; NestJS typically uses the service role and still enforces policy in code

## Consequences

- Single authoritative database with multi-schema domain boundaries
- Auth sessions managed by Supabase; MFA/passkeys available without custom crypto
- Complex financial and billing rules stay in NestJS + DB constraints, not only Edge Functions
