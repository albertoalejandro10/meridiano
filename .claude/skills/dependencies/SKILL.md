---
name: dependencies
description: Rules for adding or updating dependencies in BetoTracker. Use whenever installing, upgrading, or removing packages.
---

# Dependency Rules

- **pnpm only** — `pnpm add <pkg>` / `pnpm add -D <pkg>`. Never npm or yarn.
- **Exact versions, no `^` or `~`.** The repo `.npmrc` sets `save-prefix=""` so pnpm pins automatically. If you edit `package.json` by hand, write the exact version.
- After any `package.json` change, run `pnpm install` so `pnpm-lock.yaml` stays in sync, and commit them together (when the user asks for a commit).
- Packages with postinstall scripts must be listed in `pnpm.onlyBuiltDependencies` in `package.json`, otherwise pnpm skips their build scripts silently.
- Key pinned stack (do not downgrade): Nuxt 4, @nuxt/ui 4 (Tailwind 4 bundled, plus explicit `tailwindcss` dep for pnpm resolution), @nuxtjs/supabase 2, Prisma 7 (driver adapters, prisma.config.ts), Zod 4 (`z.uuid()`, not `z.string().uuid()`).
