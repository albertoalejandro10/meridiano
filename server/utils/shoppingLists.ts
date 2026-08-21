import { db } from '@nuxthub/db'

// Items carry no userId — ownership is enforced through the parent list.
// Every item handler must call this before touching rows.
export async function assertListOwnership(userId: string, listId: string) {
  const list = await db.query.shoppingLists.findFirst({
    where: (l, { and, eq }) => and(eq(l.id, listId), eq(l.userId, userId)),
    columns: { id: true },
  })
  if (!list) throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })
}
