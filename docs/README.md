# BetoTracker Documentation

## Quick Start

- **[SETUP.md](SETUP.md)** — Complete guide to provisioning Supabase, Google OAuth, and running the app locally

## Project Structure

### Frontend (`app/`)
- **pages/** — Routes:
  - `index.vue` — Public landing page
  - `login.vue` — Google OAuth sign-in page
  - `confirm.vue` — OAuth callback handler
  - `app/index.vue` — Dashboard (totals, recent transactions)
  - `app/accounts/index.vue` — Accounts list and cards
  - `app/transactions/index.vue` — Transaction history with filters

- **layouts/** — Page shells:
  - `default.vue` — Public layout (header, footer)
  - `dashboard.vue` — Authenticated app layout (sidebar, nav)

- **components/**
  - `UserMenu.vue` — Account dropdown (sign out, dark mode)
  - `accounts/AccountModal.vue` — Create/edit account form
  - `transactions/TransactionModal.vue` — Create/edit transaction form

- **composables/** — Reusable logic:
  - `useAccounts.ts` — Account CRUD and state
  - `useTransactions.ts` — Transaction CRUD and filtering
  - `useCurrency.ts` — Money formatting with symbols

- **assets/css/main.css** — Tailwind + Nuxt UI imports

### Backend (`server/`)
- **middleware/auth.ts** — JWT validation for `/api/v1/*` routes; mirrors Supabase users to DB
- **utils/prisma.ts** — Prisma client singleton
- **api/v1/** — REST endpoints:
  - `accounts/` — GET (list + balance), POST (create), PATCH, DELETE
  - `transactions/` — GET (list + filters), POST, PATCH, DELETE
  - `categories/` — GET (auto-seed defaults), POST

### Database (`prisma/`)
- **schema.prisma** — Prisma models (User, Account, Category, Transaction)
- **sql/rls_and_trigger.sql** — RLS policies and Supabase auth trigger (appended to migrations)
- **prisma.config.ts** (root) — Prisma 7 config: schema path, migrations path, direct connection URL
- Client is generated to `server/generated/prisma` (gitignored) and instantiated with the `@prisma/adapter-pg` driver adapter

### Shared (`shared/`)
- **schemas.ts** — Zod validators for API request/response bodies (also used by UI forms)

### Configuration
- **nuxt.config.ts** — Nuxt + Supabase + Tailwind setup
- **package.json** — Dependencies and build scripts
- **.env.example** — Template for credentials (copy to `.env` and fill in)
- **.gitignore** — Ignores `.env`, `node_modules`, `.nuxt`, etc.

## Architecture

```
User → Landing (/) → Login with Google → Supabase Auth
                                             ↓
                                    OAuth redirect to /confirm
                                             ↓
                                         /app/* (protected by @nuxtjs/supabase)
                                             ↓
                        Nuxt API route → /api/v1/* (auth middleware)
                                             ↓
                            Prisma → PostgreSQL + RLS policies
```

**Security layers:**
1. **Route guard** — `@nuxtjs/supabase` redirects unauthenticated requests to `/login`
2. **API middleware** — `server/middleware/auth.ts` validates Supabase JWT and extracts user ID
3. **RLS** — PostgreSQL policies ensure queries only return data for the authenticated user

## Key Features (Foundation Phase)

✅ **Google OAuth** — Sign in with Google  
✅ **Accounts** — Cash, bank, card, savings with balance tracking  
✅ **Transactions** — Income/expense with optional category and description  
✅ **Categories** — Auto-seeded defaults (Salary, Food, Transport, etc.)  
✅ **Multi-currency** — USD, EUR, VES stored per account; balances calculated on-the-fly  
✅ **Derived balances** — No balance column; calculated as initialBalance + signed transaction sum  
✅ **Dashboard** — Totals per currency, recent transactions list  
✅ **Forms** — Fast entry: type toggle, amount, account select (pre-fills currency), optional category, date  
✅ **RLS** — Two-layer security: API JWT check + PostgreSQL policies  

## Later Phases (Not Yet Implemented)

- Transfers (linked transaction pairs)
- Transaction tags (many-to-many)
- Budgets (monthly per category)
- Recurring transactions (rules + cron job)
- Assets and debts
- Net worth (calculated + monthly snapshots)
- Multi-currency conversion (API rate fetch + manual VES)
- Dashboard charts
- Vercel deploy configuration

## Development

```bash
# Install deps
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint

# Generate Prisma client
pnpm prisma generate

# Create and apply migrations
pnpm prisma migrate dev
```

## Docker

```bash
# Build and run with docker compose (reads credentials from .env)
docker compose up --build

# Or manually
docker build -t beto-tracker .
docker run --env-file .env -p 3000:3000 beto-tracker
```

## CI/CD

GitHub Actions ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) runs on pushes and PRs to `main`:

1. **Build** — install deps, generate Prisma client, `nuxt build`
2. **Docker image** — builds the image; on pushes to `main` it is pushed to GitHub Container Registry as `ghcr.io/<owner>/<repo>`

See [SETUP.md](SETUP.md) for provisioning instructions.
