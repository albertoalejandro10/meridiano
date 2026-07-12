import { db } from '@nuxthub/db'

// The categories FK only requires the row to exist, so cross-tenant ids would
// pass Zod + the constraint. Reject any categoryId the user doesn't own.
export async function requireOwnCategory(userId: string, categoryId: string): Promise<void> {
  const category = await db.query.categories.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, categoryId), eq(c.userId, userId)),
    columns: { id: true },
  })
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}
