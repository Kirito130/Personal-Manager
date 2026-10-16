# ADR-0010: Supabase hybrid architecture

## Status

Accepted

## Context

LifeOS (`project.md`) specifies a NestJS modular monolith with PostgreSQL, object storage, and a job worker. The product owner requires maximizing Supabase for the data plane while keeping NestJS domain services for invariants (finance, invoicing, authorization).

## Decision

```text
Browser
  ├─ Supabase Auth (session only)
  └─ Nest API  ──►  Supabase Postgres (one DB, many schemas)
                         ▲
Nest worker ─────────────┘  (outbox in same DB)
```

| Layer | Responsibility |
| --- | --- |
| **Postgres, Auth, Storage, Realtime** | Supabase (single project / database) |
| **Domain API** | NestJS (`apps/api`) — JWT validation + `PolicyService` + transactional domain rules |
| **Worker** | NestJS (`apps/worker`) — outbox consumers on the same DB |
| **Web** | Next.js — Auth session + calls Nest; no PostgREST domain writes |
| **Schema source of truth** | `supabase/migrations` (SQL) |
| **Queue** | Postgres transactional outbox (no Redis required for MVP) |
| **RLS** | Enabled on domain tables as defense in depth |

### Trust boundary rules (do)

1. **One Postgres** — schemas (`identity`, `finance_personal`, …) are domains, not separate databases.
2. **All money / org / permissioned reads and writes through Nest** — browser uses `lib/api.ts`.
3. **Supabase in the browser is Auth-only** — `createBrowserAuthClient()` exposes `{ auth }`; middleware/server clients refresh cookies only.
4. **Service role ≠ skip authz** — Nest DB pool may bypass RLS; every permissioned path must call `PolicyService` and use resource-scoped SQL.
5. **Outbox + worker share the same DB** — correlations and notifications run in `apps/worker`.
6. **Migrations only under `supabase/migrations`**.

### Do not

1. Add a second application database “for Nest”.
2. Put ledger / billing invariants only in the client or only in Edge Functions.
3. Split into microservices before real scale pain.
4. Call Supabase `.from()` / `.rpc()` from the web app for domain data.

### Optional later

- RLS-safe read-only lists via Supabase client for latency-sensitive UI.
- Collapse worker into the API process for tiny self-host if ops cost dominates.

## Consequences

- Single authoritative database with multi-schema domain boundaries.
- Auth sessions managed by Supabase; MFA/passkeys available without custom crypto.
- Complex financial and billing rules stay in Nest + DB constraints.
- Deploy three processes locally/production: web, API, worker (same repo, same DB).
