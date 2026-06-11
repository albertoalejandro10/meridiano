# BetoTracker Setup Guide

This guide walks you through provisioning Supabase and Google OAuth, then wiring them into the app.

## Phase 0: Local Development (no Supabase needed)

For day-to-day development before Supabase is provisioned:

```bash
cp .env.example .env        # ships with local-dev defaults and Supabase placeholders
docker compose up -d postgres   # Postgres 18 on localhost:5433
pnpm install
pnpm prisma migrate dev     # apply migrations to the local DB
pnpm dev                    # http://localhost:3000
```

Notes:

- The local DB runs on host port **5433** (5432 is often taken by other projects).
- With placeholder `SUPABASE_URL`/`SUPABASE_KEY`, all pages render and `/api/v1/*` correctly returns 401, but Google login does not work until Phases 1–3 are done.
- `prisma/sql/rls_and_trigger.sql` is **Supabase-only** (it references the `auth` schema) — do not apply it to the local Postgres. It gets appended to a migration when moving to Supabase (Phase 4).

## Phase 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account with GitHub)
2. Click **New Project**
   - **Name**: betotrack (or any name you prefer)
   - **Database Password**: Save this securely (shown only once)
   - **Region**: Choose the closest to you (e.g., São Paulo for South America, us-east-1 for US)
   - Click **Create new project** and wait ~2 minutes for the database to initialize

3. Once ready, go to **Project Settings** (gear icon, bottom left)
4. Click **API Keys** in the left sidebar
5. Copy these values into your `.env` file (use the **new API keys**, not the legacy `anon`/`service_role` JWT keys):
   - **Project URL** → `SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `SUPABASE_KEY`
   - Optionally, create/copy a **Secret key** (`sb_secret_...`) → `SUPABASE_SERVICE_KEY` (server-only; not needed yet)

> If the dashboard still shows legacy keys, open the **API Keys** page and click **Create new API keys** / opt in to the publishable & secret keys.

Example `.env` so far:
```
SUPABASE_URL=https://abcdef123456.supabase.co
SUPABASE_KEY=sb_publishable_AbCdEf123456...
DATABASE_URL=
DIRECT_URL=
```

6. Still in **Settings** → **Database**, find **Connection strings**:
   - Copy the **Connection pooler** string (port 6543) → `DATABASE_URL`
   - Append `?pgbouncer=true&connection_limit=1` to the end
   - Copy the **Direct connection** string (port 5432) → `DIRECT_URL`

Your `.env` should now look like:
```
SUPABASE_URL=https://abcdef123456.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.abcdef123456:PASSWORD@ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.abcdef123456:PASSWORD@ap-southeast-1.db.supabase.com:5432/postgres
```

## Phase 2: Create Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a **new project**:
   - Click the project dropdown at the top
   - Click **NEW PROJECT**
   - **Project name**: BetoTracker
   - Click **Create** and wait a few seconds

3. Enable OAuth:
   - In the search bar at the top, search for **OAuth consent screen**
   - Click **OAuth consent screen** in the results
   - **User Type**: External
   - Click **Create**
   - Fill in:
     - **App name**: BetoTracker
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Click **Save and Continue** → skip scopes → **Save and Continue** → **Back to Dashboard**

4. Add yourself as a test user:
   - On the OAuth consent screen page, scroll to **Test users**
   - Click **Add users**
   - Add your email address
   - Click **Save**

5. Create OAuth credentials:
   - Search for **Credentials** in the top search bar
   - Click **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - **Application type**: Web application
   - **Name**: BetoTracker Web Client
   - Under **Authorized redirect URIs**, add:
     - `http://localhost:3000/confirm` (for local development)
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` (replace `<YOUR_SUPABASE_PROJECT_REF>` with your Supabase project ref, e.g., `abcdef123456`)
   - Click **Create**
   - A modal with **Client ID** and **Client secret** will appear — **copy both** (you'll use them next)

## Phase 3: Configure Supabase Auth with Google

1. Go back to Supabase dashboard
2. Click **Authentication** (left sidebar)
3. Click **Providers**
4. Find **Google** and click it
5. Paste the credentials from Google Cloud:
   - **Client ID**: (from Google Cloud)
   - **Client Secret**: (from Google Cloud)
6. Click **Save**

7. Go to **Authentication** → **URL Configuration**
8. Set:
   - **Site URL**: `http://localhost:3000` (for local dev; change to your Vercel URL later)
   - **Redirect URL**: `http://localhost:3000/confirm` (add this to the list if not there)
9. Click **Save**

## Phase 4: Run Prisma Migrations

Now that `.env` has database credentials, initialize the schema:

```bash
pnpm prisma migrate dev --name init --create-only
```

This creates `prisma/migrations/<timestamp>_init/migration.sql`. Open it and **append** the contents of `prisma/sql/rls_and_trigger.sql` to the end of the file.

Then apply the migration:

```bash
pnpm prisma migrate dev
```

This creates all tables, RLS policies, and the auth trigger that mirrors Supabase users into `public.users`.

## Phase 5: Run the App

Start the dev server:

```bash
pnpm dev
```

Visit `http://localhost:3000` and test the flow:
1. Click **Get started** → lands on `/login`
2. Click **Continue with Google** → Google OAuth flow
3. Grant permissions → redirects to `/confirm` → then to `/app` (dashboard)
4. Create an account (click **New account** button)
5. Create a transaction (click **New transaction** button)
6. Verify balances update

## Phase 6: Verify Security

**Test that unauthenticated requests are rejected:**

```bash
curl -i http://localhost:3000/api/v1/accounts
# Should return 401 Unauthorized
```

**Test RLS in Supabase:**
1. Go to Supabase dashboard → **SQL Editor**
2. Run:
   ```sql
   select * from accounts;
   ```
   As the **authenticated user** (your account) — you see your accounts.
   As an **anonymous user** (or another user) — you see nothing.

## Troubleshooting

**"Missing NUXT_PUBLIC_SUPABASE_URL" warning on startup**
- Make sure `.env` file exists in the root with `SUPABASE_URL` and `SUPABASE_KEY` filled in

**"Database connection failed"**
- Check that `DATABASE_URL` and `DIRECT_URL` are correctly copied from Supabase
- Ensure the password in the connection string matches what you saved during project creation

**Google login redirects to a blank page**
- Verify the redirect URI in Google Cloud Console matches exactly: `https://<project-ref>.supabase.co/auth/v1/callback`
- Check Supabase → Authentication → URL Configuration has the correct Site URL and Redirect URL

**"Table doesn't exist" error**
- Run `pnpm prisma migrate dev` to apply migrations

---

## Next Steps

Once the app is running locally:
- Explore the transaction UI and create a few sample accounts and transactions
- Test the filters and delete operations
- When ready to deploy, follow [VERCEL.md](VERCEL.md) for Vercel setup (coming soon)
