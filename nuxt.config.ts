// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxthub/core', '@nuxt/ui', 'nuxt-charts', '@pinia/nuxt', 'nuxt-auth-utils', 'motion-v/nuxt', '@nuxtjs/i18n'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  i18n: {
    // No locale in URLs — the language is a user preference (Settings →
    // Preferences), persisted in the i18n cookie like the theme is.
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json', language: 'en-US' },
      { code: 'es', name: 'Español', file: 'es.json', language: 'es-VE' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en',
    },
  },
  runtimeConfig: {
    public: {
      // Canonical origin for links we send out (password reset). Required in
      // production — never derived from the request Host header. Override with
      // NUXT_PUBLIC_SITE_URL; empty in dev falls back to the request origin.
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
