import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!

  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, id), eq(a.userId, userId)),
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  const txCount = await db.$count(schema.transactions, eq(schema.transactions.accountId, id))
  if (txCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Account has transactions. Archive it instead.',
    })
  }

  await db.delete(schema.accounts).where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)))
  return { ok: true }
})
