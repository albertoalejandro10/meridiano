# Meridiano

Personal finance, clearly. Multi-currency accounts, transactions, transfers, goals, and
net worth — built for people whose money doesn't live in one currency or one country.

Bilingual (English / Español). Amounts are never summed across currencies: net worth is
computed per currency, because there are no FX rates to fake.

## Stack

Nuxt 4 · NuxtHub · PostgreSQL via Drizzle ORM · nuxt-auth-utils · Nuxt UI v4 · Pinia ·
Zod 4 · nuxt-charts · date-fns · @nuxtjs/i18n

## Getting started

```bash
pnpm install
cp .env.example .env             # set NUXT_SESSION_PASSWORD (≥32 chars)
docker compose up -d postgres    # local Postgres 18 on port 5433
pnpm dev                         # http://localhost:3000
```

`pnpm dev` applies any pending database migrations on boot.

```bash
npx nuxt db generate   # generate a migration after editing server/db/schema.ts
npx nuxt db migrate    # apply migrations to the DB at DATABASE_URL
pnpm build             # production build (no database needed)
```

Use **pnpm** — never npm or yarn. Dependency versions are pinned exact.

## Documentation

- [docs/STATUS.md](docs/STATUS.md) — what's built, known limitations, roadmap
- [docs/SETUP.md](docs/SETUP.md) — local setup, migrations, deployment, troubleshooting
- [docs/MVP_GAP.md](docs/MVP_GAP.md) — phase-by-phase gap analysis
- [docs/AI_FEATURES.md](docs/AI_FEATURES.md) — the AI digest and coaching features
- [CLAUDE.md](CLAUDE.md) — architecture notes and conventions

## License

All rights reserved. This source is public for reference; it is not licensed for reuse,
redistribution, or derivative works.
