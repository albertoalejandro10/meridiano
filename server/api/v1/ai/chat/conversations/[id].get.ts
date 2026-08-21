import { db } from '@nuxthub/db'

// Full conversation + its messages, in the AI SDK's UIMessage shape
// (id/role/parts) so the client can hand them straight to useChat().
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const conversation = await db.query.chatConversations.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, id), eq(c.userId, userId)),
    with: {
      messages: {
        orderBy: (m, { asc }) => [asc(m.createdAt)],
        columns: { id: true, role: true, parts: true },
      },
    },
  })
  if (!conversation) throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })

  return conversation
})
