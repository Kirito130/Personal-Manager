# Supabase Cloud setup (LifeOS)

Use the hosted project instead of Docker. Local Docker remains optional for offline work.

## Project

| Field | Value |
| --- | --- |
| Org | Kirito13 |
| Name | Personal-Manager |
| Ref | `hnzcnvacszodrblesage` |
| URL | https://hnzcnvacszodrblesage.supabase.co |
| Region | us-east-1 |

Schema migrations M01–M15 (+ uuidv7 fix) are already applied on this project.

## 1. Fill `.env` secrets

Copy from the dashboard into `.env` (names only in git; never commit real secrets):

1. **Project Settings → API**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon / publishable key (already set for this project)
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role (secret; server-only)
   - `SUPABASE_JWT_SECRET` — JWT Secret
2. **Project Settings → Database**
   - Database password (set/reset if needed)
   - `DATABASE_URL` direct URI:
     `postgresql://postgres:[PASSWORD]@db.hnzcnvacszodrblesage.supabase.co:5432/postgres`

## 2. Auth redirect URLs (required for local web)

**Authentication → URL Configuration:**

- Site URL: `http://localhost:3000`
- Redirect URLs (add all):
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`

Enable Email provider if you use email/password signup.

## 3. Expose custom schemas on the Data API

**Project Settings → Data API → Exposed schemas** — include:

`public`, `graphql_public`, `identity`, `platform`, `planning`, `personal`, `workforce`, `crm`, `finance_personal`, `finance_business`, `collaboration`

(Nest talks to Postgres via `DATABASE_URL`; this step matters for any direct Supabase client queries against those schemas.)

## 4. Link the CLI (optional, for future `db push`)

```bash
npx supabase login
npx supabase link --project-ref hnzcnvacszodrblesage
# enter the database password when prompted
npx supabase db push   # only for NEW local migrations not yet on cloud
```

Do **not** re-push migrations that are already on cloud (they were applied via the management API). New files under `supabase/migrations/` should use `db push` after link.

## 5. Run the app against cloud

```bash
pnpm install
pnpm --filter @lifeos/shared build
pnpm --filter @lifeos/contracts build
pnpm dev:api
pnpm --filter @lifeos/worker dev
pnpm dev:web
```

No `supabase start` / Docker required.

## 6. First user

1. Open http://localhost:3000/signup
2. Create an account (Auth creates `identity.profiles` + personal space via trigger)
3. Optionally bootstrap a personal ledger in SQL Editor:

```sql
SELECT identity.ensure_personal_finance_book('<your-auth-user-uuid>');
```

## Switching back to Docker

Comment cloud values in `.env` and use the Option B block from `.env.example`, then `npx supabase start`.
