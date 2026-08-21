// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxt/ui', 'nuxt-charts', '@pinia/nuxt', 'nuxt-auth-utils', 'motion-v/nuxt', '@nuxtjs/i18n', '@comark/nuxt'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  vite: {
    // The landing hero's WebGL background (`shaders/vue`) pulls in Three.js.
    // Letting Vite pre-bundle them produces a single ~5 MB optimized file in
    // which esbuild has stripped `import.meta.url`; Vite's asset-import-meta-url
    // transform filter (`/new\s+URL.+import\.meta\.url/s`) then backtracks the
    // whole blob and dev crashes with "Maximum call stack size exceeded".
    // Excluding them keeps the raw ESM (with `import.meta.url` intact), so the
    // filter matches fast. Dev-only: production build doesn't pre-bundle deps.
    optimizeDeps: { exclude: ['shaders', 'three'] },
  },
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json', language: 'en-US' },
      { code: 'es', name: 'Español', file: 'es.json', language: 'es-ES' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en',
    },
  },
  runtimeConfig: {
    // Server-only — set via NUXT_OPENCODE_API_KEY (an OpenCode Go API key, see
    // https://opencode.ai/docs/go/). Empty in dev until configured; the AI
    // digest endpoint returns 503 rather than calling out with no key.
    opencodeApiKey: '',
    public: {
      siteUrl: '',
    },
  },
  hub: {
    // NuxtHub Database — PostgreSQL dialect via Drizzle ORM (postgres-js driver).
    // Connection is read from DATABASE_URL (see .env / docker-compose Postgres).
    db: {
      dialect: 'postgresql',
      // Migrations auto-apply on `nuxt dev`; skip during `nuxt build` so CI
      // (and the Docker image build) don't need a live database. Apply them
      // explicitly with `npx nuxt db migrate` at deploy time.
      applyMigrationsDuringBuild: false,
    },
    // POST-MVP — Nuxt Blob Storage for transaction receipts + user avatars.
    // Enabling needs the NuxtHub blob binding; see docs/ roadmap before turning on.
    // blob: true,
  },
})
