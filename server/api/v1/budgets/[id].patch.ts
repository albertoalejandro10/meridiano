import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { budgetUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, budgetUpdateSchema.parse)

  const { amount, categoryId, ...rest } = body
  const data = {
    ...rest,
    ...(amount !== undefined && { amount: toAmount(amount) }),
    ...(categoryId !== undefined && { categoryId }),
  }
  assertNotEmpty(data)
  if (categoryId !== undefined) await requireOwnCategory(userId, categoryId)

  const [budget] = await db
    .update(schema.budgets)
    .set(data)
    .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)))
    .returning()
  if (!budget) throw createError({ statusCode: 404, statusMessage: 'Budget not found' })

  return budget
})
