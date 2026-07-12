---
name: dev-workflow
description: How to run, build, and verify BetoTracker locally. Use when starting the dev environment, running the app, applying database migrations, or verifying changes.
---

# BetoTracker Dev Workflow

## Package manager

**Always pnpm.** Never use npm or yarn for anything in this repo.

## Start the local environment

```bash
docker compose up -d postgres   # Postgres 18 on localhost:5433 (NOT 5432)
pnpm dev                        # http://localhost:3000
```

The local DB credentials live in `.env` (see `.env.example`). Host port is **5433** because 5432 is taken by another project's container (`faiplus-postgres`) — never stop or touch that container.

## Database / Prisma 7

- Config is in `prisma.config.ts` (NOT in schema.prisma — Prisma 7 forbids `url` there). Migrations use `DIRECT_URL`; the runtime client uses `DATABASE_URL` through `@prisma/adapter-pg` (`server/utils/prisma.ts`).
- Generated client output: `server/generated/prisma` (gitignored). After schema changes: `pnpm prisma generate`.
- Migrations: `pnpm prisma migrate dev --name <name>`.
- `prisma/sql/rls_and_trigger.sql` is **Supabase-only** (references the `auth` schema). Never apply it to the local Postgres; it gets appended to a migration when deploying to Supabase.

## Auth in local dev

`.env` carries Supabase placeholders until the Supabase project is provisioned. Pages render and `/api/v1/*` returns 401 without a session, but Google login does not work locally yet. Don't try to "fix" this.

## Language

The application UI is **English-only** — all labels, messages, titles, placeholders, error text, etc. Never use Spanish strings, including default/fallback values in composables and components.

## Verify changes

```bash
pnpm build                                          # must pass
curl -s -o /dev/null -w "%{http_code}" localhost:3000/                  # 200
curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/v1/accounts  # 401 without session
```
