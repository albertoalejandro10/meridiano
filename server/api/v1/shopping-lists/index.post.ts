import { db, schema } from '@nuxthub/db'
import { shoppingListSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, shoppingListSchema.parse)

  const [created] = await db
    .insert(schema.shoppingLists)
    .values({
      name: body.name,
      ...(body.bcvRate != null && { bcvRate: toRate(body.bcvRate) }),
      ...(body.binanceRate != null && { binanceRate: toRate(body.binanceRate) }),
      userId,
    })
    .returning()

  return created
})
