# LifeOS API overview

Base path: `/api/v1`  
Auth: `Authorization: Bearer <supabase_access_token>`  
OpenAPI UI (local): `http://localhost:3001/api/docs`

## Modules

| Area | Prefix |
| --- | --- |
| Health | `GET /health` |
| Identity | `GET /me`, `GET|POST /workspaces` |
| Today / search | `GET /home`, `GET /today`, `GET /search` |
| Tasks | `/tasks` |
| Calendar | `/calendar/events`, `/calendar/time-blocks` |
| Focus | `/focus-sessions` |
| Personal life | `/goals`, `/habits`, `/journal/entries`, `/notes` |
| Personal finance | `/personal-finance/*` |
| Correlations | `/finance-correlations/*` |
| Projects / boards | `/projects`, `/boards/:id` |
| Workforce | `/time-entries`, `/timesheets`, `/attendance`, `/capacity` |
| CRM | `/crm/*` |
| Billing | `/billing/*`, `/business-expenses` |
| Knowledge | `/knowledge-spaces`, `/articles` |
| Automation | `/automations` |
| Reports | `/reports` |
| Notifications | `/notifications` |

Money amounts are decimal strings with ISO currency codes. Use `Idempotency-Key` on payment creates.
