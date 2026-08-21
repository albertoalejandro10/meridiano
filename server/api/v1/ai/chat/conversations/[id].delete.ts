import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const deleted = await db
    .delete(schema.chatConversations)
    .where(and(eq(schema.chatConversations.id, id), eq(schema.chatConversations.userId, userId)))
    .returning({ id: schema.chatConversations.id })
  if (deleted.length === 0) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  return { ok: true }
})
