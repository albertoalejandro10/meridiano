import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need the direct (non-pooled) connection, port 5432.
    // Falls back to a placeholder so `prisma generate` works without an .env.
    url: process.env.DIRECT_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
