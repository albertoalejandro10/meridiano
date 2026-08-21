import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const existing = await db.query.recurringTransactions.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, id), eq(r.userId, userId)),
    columns: { id: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Recurring payment not found' })

  // Occurrences cascade away with the template; the transactions they created
  // stay put with recurringId nulled (set null) — deleting a template is
  // "stop asking me", never "erase the payments I made".
  await db.delete(schema.recurringTransactions).where(eq(schema.recurringTransactions.id, id))

  return { ok: true }
})
