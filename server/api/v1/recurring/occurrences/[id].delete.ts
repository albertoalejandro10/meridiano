import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

// Undo an answer: the due date goes back to pending and gets asked again.
// A PAID answer takes its transaction with it — leaving the charge behind would
// double-count it the moment the user re-answers the same occurrence.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const occurrence = await db.query.recurringOccurrences.findFirst({
    where: (o, { and, eq }) => and(eq(o.id, id), eq(o.userId, userId)),
    columns: { id: true, transactionId: true },
  })
  if (!occurrence) throw createError({ statusCode: 404, statusMessage: 'Occurrence not found' })

  await db.transaction(async (tx) => {
    await tx.delete(schema.recurringOccurrences).where(eq(schema.recurringOccurrences.id, id))
    if (occurrence.transactionId) {
      // Any fee rows attached to it cascade via feeOfId.
      await tx.delete(schema.transactions).where(eq(schema.transactions.id, occurrence.transactionId))
    }
  })

  return { ok: true }
})
