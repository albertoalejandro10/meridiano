# MVP Gap Analysis

> Last updated: 2026-06-29. Companion to [STATUS.md](STATUS.md) — this document tracks what the MVP plan calls for vs. what exists, so we always know what's missing.

## Foundation phase

| # | Phase | Status | Notes |
| --- | --- | --- | --- |
| 1 | Dependencies & base config | ✅ Done | Nuxt 4 + Nuxt UI v4 + @nuxthub/core + nuxt-auth-utils + Drizzle ORM + Zod 4 + Pinia + nuxt-charts + date-fns, all pinned exact |
| 2 | Template code (Dashboard + SaaS) | ✅ Done | Vendored via tarball, adapted to Maybe-style UI |
| 3 | NuxtHub Database (Postgres) + Drizzle | ✅ Done | `hub.db.dialect: 'postgresql'`; schema in `server/db/schema.ts`; migration generated + applied |
| 4 | Auth (nuxt-auth-utils, email/password) | ✅ Done | `server/api/auth/*` + middleware + route guard; sealed-cookie sessions, hashed passwords |
| 5 | Accounts + Transactions + Goals CRUD | ✅ Done | API + pages + modals + derived balances |
| — | Verification (E2E) | ✅ Done | 27/27 automated checks against local Postgres: auth, CRUD, derived balances, numeric/date round-trip, relations, pagination, ownership isolation |

## Beyond plan (done without being scheduled)

- Maybe-style home page (tabs panel, net worth chart, assets table)
- **Goals** feature (model + API + page)
- Confirm dialog system (`useConfirm` + `ConfirmModal`)
- Dockerfile, docker-compose (local Postgres 18), GitHub Actions CI
- Branding (logo + favicon), chart component library convention (`app/components/chart/`)

## Missing for a usable MVP (ordered)

1. ✅ **Dev auth bypass removed** — the API/UI now require a real session; `/app` redirects to `/login` when logged out.
2. **Auth hardening** — password reset is implemented but email delivery is stubbed (`server/utils/mail.ts` logs the link); wire an email provider to make it usable in production, then add email verification. Optional: Google OAuth via `defineOAuthGoogleEventHandler`.
3. **Net worth time-series endpoint** — home chart currently reconstructs history client-side from the last 50 transactions (wrong once data grows).
4. **Multi-currency correctness** — home page sums balances across currencies as if one; needs per-currency display or conversion.
5. **Deployment** — managed Postgres (`DATABASE_URL`), a 32+ char `NUXT_SESSION_PASSWORD`, and `npx nuxt db migrate` at deploy. Build needs no DB (`applyMigrationsDuringBuild` is off).

## Post-MVP roadmap

1. **Blob storage** — transaction receipt attachments + user avatars via NuxtHub Blob (`hub.blob`). Schema already reserves `transactions.receiptPathname` and `users.avatarPathname`; endpoints are sketched in [SETUP.md](SETUP.md#post-mvp-blob-storage).
2. Transfers (linked pair + `transferId`)
3. Tags (m:n) + category management UI
4. Budgets
5. ~~Recurring transactions (`RecurringRule` + cron)~~ — **shipped, deliberately without a cron** (confirm-first: the app asks whether each due bill was paid instead of auto-creating it). See the Recurring payments section in `CLAUDE.md`.
6. Assets/Debts as first-class models + net worth snapshots (home page currently infers them from accounts)
7. Multi-currency conversion (FreeCurrencyAPI cron, manual VES rate)
8. More dashboard charts
