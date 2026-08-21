import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const listId = getRouterParam(event, 'id')!
  const itemId = getRouterParam(event, 'itemId')!

  await assertListOwnership(userId, listId)

  const deleted = await db
    .delete(schema.shoppingListItems)
    .where(and(eq(schema.shoppingListItems.id, itemId), eq(schema.shoppingListItems.listId, listId)))
    .returning({ id: schema.shoppingListItems.id })
  if (deleted.length === 0) throw createError({ statusCode: 404, statusMessage: 'Item not found' })

  return { ok: true }
})
