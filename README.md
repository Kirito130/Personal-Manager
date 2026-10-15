# LifeOS

Independent personal & professional management platform.  
Authoritative product contract: [`project.md`](./project.md).

## Architecture

- **Database / Auth / Storage / Realtime:** Supabase
- **API:** NestJS modular monolith (`apps/api`)
- **Worker:** Postgres outbox consumer (`apps/worker`) — finance correlations, notifications
- **Web / PWA:** Next.js (`apps/web`)

Personal and business finance books stay separate, with owner-controlled **salary → personal income** correlations.

## Quick start (Supabase Cloud)

Docker is optional. Prefer the hosted project — see [`docs/runbooks/supabase-cloud.md`](./docs/runbooks/supabase-cloud.md).

```bash
pnpm install
cp .env.example .env
# Fill cloud URL, anon key, service_role, JWT secret, DATABASE_URL from the dashboard
# Auth redirects + exposed schemas: follow the cloud runbook
pnpm --filter @lifeos/shared build
pnpm --filter @lifeos/contracts build
pnpm dev:api
pnpm --filter @lifeos/worker dev
pnpm dev:web
```

### Optional: local Docker Supabase

```bash
npx supabase start
# copy keys from `npx supabase status` into .env
```

- API: http://localhost:3001/api/v1/health  
- Docs: http://localhost:3001/api/docs  
- Web: http://localhost:3000  
- Cloud project: `hnzcnvacszodrblesage` (Personal-Manager)

## Monorepo layout

```text
apps/api apps/web apps/worker
packages/shared packages/contracts packages/ui
supabase/migrations   # full Phase 0–6 schema (M01–M15)
docs/adr docs/domain docs/runbooks
```

## Implementation order (completed in this repo)

1. Full database schema (Phases 0–6)  
2. Backend + frontend per phase (foundation → tasks → personal/finance → work → CRM/billing → knowledge/reports → hardening docs)

## License

See [LICENSE](./LICENSE).
