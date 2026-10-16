# LifeOS trust boundary

See [ADR-0010](../adr/0010-supabase-hybrid.md) for the full decision.

| Actor | May touch |
| --- | --- |
| Browser | Supabase Auth; Nest `/api/v1/*` with bearer JWT |
| Nest API | Postgres via `DATABASE_URL` after `PolicyService` checks |
| Nest worker | Same Postgres outbox/inbox (system consumer) |
| Supabase RLS | Defense in depth for any future direct client reads |

`SUPABASE_SERVICE_ROLE_KEY` is server-only (API). It validates JWTs; it does not replace per-resource authorization.
