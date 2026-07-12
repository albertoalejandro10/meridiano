import { createHash } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { passwordResetSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const { token, password } = await readValidatedBody(event, passwordResetSchema.parse)

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const row = await db.query.passwordResetTokens.findFirst({
    where: (t, { and, eq, gt, isNull }) => and(
      eq(t.tokenHash, tokenHash),
      isNull(t.usedAt),
      gt(t.expiresAt, new Date()),
    ),
  })
  if (!row) {
    throw createError({ statusCode: 400, statusMessage: 'This reset link is invalid or has expired' })
  }

  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, row.userId))

    // Consume this token and invalidate any other outstanding ones for the user.
    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResetTokens.userId, row.userId), isNull(schema.passwordResetTokens.usedAt)))
  })

  return { ok: true }
})
