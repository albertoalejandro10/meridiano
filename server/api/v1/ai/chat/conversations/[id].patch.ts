import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { aiChatRenameConversationSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, aiChatRenameConversationSchema.parse)

  const [updated] = await db
    .update(schema.chatConversations)
    .set({ title: body.title })
    .where(and(eq(schema.chatConversations.id, id), eq(schema.chatConversations.userId, userId)))
    .returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  return updated
})
