import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { shoppingListItemUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const listId = getRouterParam(event, 'id')!
  const itemId = getRouterParam(event, 'itemId')!
  const body = await readValidatedBody(event, shoppingListItemUpdateSchema.parse)

  await assertListOwnership(userId, listId)

  const { quantity, unitPrice, ...rest } = body
  const data = {
    ...rest,
    ...(quantity !== undefined && { quantity: toQty(quantity) }),
    ...(unitPrice !== undefined && { unitPrice: toAmount(unitPrice) }),
  }
  assertNotEmpty(data)

  const [updated] = await db
    .update(schema.shoppingListItems)
    .set(data)
    .where(and(eq(schema.shoppingListItems.id, itemId), eq(schema.shoppingListItems.listId, listId)))
    .returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Item not found' })

  return updated
})
