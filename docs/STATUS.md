# BetoTracker — Project Status

> Last updated: 2026-06-29. Keep this document current as features land.

BetoTracker is a personal finance web app (fast transaction entry, multi-currency, dashboards), UI/UX inspired by [Maybe Finance](https://github.com/maybe-finance/maybe), built with Nuxt UI.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Nuxt 4 (`app/` structure) + Nuxt UI v4 (Tailwind v4) |
| Platform | NuxtHub (`@nuxthub/core`) |
| Auth | nuxt-auth-utils — email/password, sealed-cookie sessions (`server/api/auth/*`) |
| Database | NuxtHub Database — PostgreSQL via Drizzle ORM (`postgres-js`); Docker `postgres:18-alpine` locally (port **5433**) |
| ORM | Drizzle ORM (`server/db/schema.ts`, `@nuxthub/db`; migrations in `server/db/migrations/postgresql/`) |
| State | Pinia (`app/stores/session.ts`) |
| Charts | nuxt-charts (`app/components/chart/`, see its README) |
| Validation | Zod 4 (`shared/schemas.ts`, shared by API and forms) |
| Dates | date-fns (`app/utils/dates/`) |
| Tooling | pnpm only, exact pinned versions, ESLint; Dockerfile + GitHub Actions CI |

## Done (foundation phase)

- **Data model**: User, Account (assets: CASH/INVESTMENT/CRYPTO/PROPERTY/VEHICLE/OTHER_ASSET; liabilities: CREDIT_CARD/LOAN/OTHER_LIABILITY), Category, Transaction (INCOME/EXPENSE), Goal — Drizzle schema in `server/db/schema.ts` with derived balances (never stored). Ownership is enforced in every handler by filtering on `userId` (no SQL-level RLS).
- **Auth**: Email/password via nuxt-auth-utils. `server/api/auth/{register,login,logout}` issue/clear a sealed-cookie session; passwords are hashed with `hashPassword`/`verifyPassword`. New users are seeded with default categories on register. `server/api/auth/password/{request,reset}` provide a single-use-token password-reset flow (SHA-256-hashed tokens, 1h expiry; email delivery stubbed in `server/utils/mail.ts`). `server/middleware/auth.ts` requires the session for `/api/v1/*` and sets `event.context.userId`.
- **API**: `/api/v1/accounts`, `/api/v1/transactions` (filters + keyset cursor pagination), `/api/v1/categories` (defaults seeded at register, with a lazy seed-on-first-GET fallback), `/api/v1/goals` — full CRUD, ownership-scoped.
- **Dashboard shell**: collapsible sidebar (defaults collapsed; toggle in footer above UserMenu), Maybe-style — no page navbars.
- **Home page (Maybe-style)**: left collapsible panel with Assets/Debts/All tabs + per-account sparkline collapsibles; right side with breadcrumb, welcome header, "New" transaction button, net worth area chart, assets weight table.
- **Pages**: `/app/transactions` (list + filters), `/app/accounts` (cards grid), `/app/goals`, all with create/edit modals and `useConfirm()` delete confirmation.
- **Goals**: target amount, currency, start/target dates + `/api/v1/goals` CRUD. Progress = net savings (income − expenses) in the goal's currency since its start date.
- **Verification**: full auth + CRUD flow verified end-to-end against local Postgres (register/login/logout, derived balances, numeric/date round-trip, nested relations, category seeding, keyset pagination, ownership isolation).
- **Conventions**: Nuxt default component naming (`account/Modal.vue` → `<AccountModal>`); `components/global/` for global overlays; utils in `app/utils` (money/percent) and `app/utils/dates` (date-fns); English-only UI; never auto-commit.

## Not done yet

- **Deployment** — Dockerfile and CI exist; no environment is deployed. Production needs a managed Postgres (`DATABASE_URL`) and a 32+ char `NUXT_SESSION_PASSWORD`.
- **Auth hardening** — no email verification or password reset yet.

## Known limitations / tech debt

- Net worth & sparkline series are reconstructed client-side from the last 50 fetched transactions — needs a real time-series endpoint.
- Assets/Debts are inferred from accounts (CARD or negative balance = debt) — no dedicated Asset/Debt models yet.
- Multi-currency totals naively assume one currency on the home page (no conversion).
- `useConfirm` composable exists; only wired to delete actions so far.

## Roadmap (in order)

1. **Blob storage (post-MVP)** — transaction receipt attachments + user avatars via NuxtHub Blob (`hub.blob`). Schema already reserves `transactions.receiptPathname` and `users.avatarPathname`; see [SETUP.md](SETUP.md#post-mvp-blob-storage).
2. Transfers (linked transaction pair + nullable `transferId`)
3. Tags (m:n) + category management UI
4. Budgets
5. Recurring transactions (`RecurringRule` + cron)
6. Assets/Debts as first-class models + net worth snapshots
7. Multi-currency conversion (FreeCurrencyAPI cron, manual VES rate)
8. More dashboard charts (see `app/components/chart/README.md`)
9. Production deploy (managed Postgres, `nuxt db migrate`, session secret, OAuth if desired)
