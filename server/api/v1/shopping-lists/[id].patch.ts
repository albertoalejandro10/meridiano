import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { shoppingListUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, shoppingListUpdateSchema.parse)

  const { bcvRate, binanceRate, ...rest } = body
  const data = {
    ...rest,
    ...(bcvRate !== undefined && { bcvRate: bcvRate === null ? null : toRate(bcvRate) }),
    ...(binanceRate !== undefined && { binanceRate: binanceRate === null ? null : toRate(binanceRate) }),
  }
  assertNotEmpty(data)

  const [updated] = await db
    .update(schema.shoppingLists)
    .set(data)
    .where(and(eq(schema.shoppingLists.id, id), eq(schema.shoppingLists.userId, userId)))
    .returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })

  return updated
})
