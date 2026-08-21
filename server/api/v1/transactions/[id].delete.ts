import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const row = await db.query.transactions.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
    columns: { id: true, transferId: true },
  })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  // Deleting one leg of a transfer removes the whole pair, so balances stay consistent.
  if (row.transferId) {
    await db
      .delete(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.transferId, row.transferId)))
  }
  else {
    await db
      .delete(schema.transactions)
      .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
  }

  return { ok: true }
})
