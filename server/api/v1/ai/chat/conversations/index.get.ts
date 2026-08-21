import { db } from '@nuxthub/db'

// Sidebar conversation list — no messages, just enough to render the list.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  return db.query.chatConversations.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { desc }) => [desc(c.updatedAt)],
    columns: { id: true, title: true, model: true, createdAt: true, updatedAt: true },
  })
})
