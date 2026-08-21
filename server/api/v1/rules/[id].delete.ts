import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const existing = await db.query.transactionRules.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, id), eq(r.userId, userId)),
    columns: { id: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Rule not found' })

  // No renumbering: priority gaps are fine, only the relative order matters.
  await db.delete(schema.transactionRules).where(eq(schema.transactionRules.id, id))

  return { ok: true }
})
