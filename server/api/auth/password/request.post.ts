import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, eq, lt } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { passwordResetRequestSchema } from '~~/shared/schemas'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// The reset link must never be built from the request's Host header — a forged
// Host would put an attacker-controlled origin in the email (token theft).
function resetOrigin(event: H3Event): string {
  const { siteUrl } = useRuntimeConfig(event).public
  if (siteUrl) return siteUrl.replace(/\/$/, '')
  if (import.meta.dev) return getRequestURL(event).origin
  throw createError({ statusCode: 500, statusMessage: 'NUXT_PUBLIC_SITE_URL must be configured' })
}

export default defineEventHandler(async (event) => {
  const { email } = await readValidatedBody(event, passwordResetRequestSchema.parse)

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
    columns: { id: true, passwordHash: true },
  })

  // Only issue a token for a real, password-based account — but always return the
  // same response so callers can't probe which emails are registered.
  if (user?.passwordHash) {
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // Opportunistic cleanup: this user's expired tokens are dead weight.
    await db.delete(schema.passwordResetTokens).where(and(
      eq(schema.passwordResetTokens.userId, user.id),
      lt(schema.passwordResetTokens.expiresAt, new Date()),
    ))

    await db.insert(schema.passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    })

    const resetUrl = `${resetOrigin(event)}/reset-password?token=${token}`
    await sendPasswordResetEmail(email, resetUrl)
  }

  return { ok: true }
})
