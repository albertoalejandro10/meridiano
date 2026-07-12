import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!

  const deleted = await db
    .delete(schema.goals)
    .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
    .returning({ id: schema.goals.id })
  if (deleted.length === 0) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })

  return { ok: true }
})
