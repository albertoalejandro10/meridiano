import { db, schema } from '@nuxthub/db'
import { eq, max } from 'drizzle-orm'
import { shoppingListItemSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const listId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, shoppingListItemSchema.parse)

  await assertListOwnership(userId, listId)

  // Append at the end. The client posts items through a sequential queue, so a
  // plain max+1 keeps typing order without needing row locks for a single user.
  const [row] = await db
    .select({ maxPosition: max(schema.shoppingListItems.position) })
    .from(schema.shoppingListItems)
    .where(eq(schema.shoppingListItems.listId, listId))

  const [created] = await db
    .insert(schema.shoppingListItems)
    .values({
      listId,
      name: body.name,
      quantity: toQty(body.quantity),
      unitPrice: toAmount(body.unitPrice),
      checked: body.checked,
      position: (row!.maxPosition ?? 0) + 1,
    })
    .returning()

  return created
})
