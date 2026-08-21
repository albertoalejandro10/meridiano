import { db, schema } from '@nuxthub/db'
import { budgetSchema } from '~~/shared/schemas'

// Upsert: re-adding a (category, currency) pair that already has a budget
// updates its limit instead of failing on the unique constraint.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, budgetSchema.parse)

  await requireOwnCategory(userId, body.categoryId)

  const [budget] = await db
    .insert(schema.budgets)
    .values({
      userId,
      categoryId: body.categoryId,
      currency: body.currency,
      amount: toAmount(body.amount),
    })
    .onConflictDoUpdate({
      target: [schema.budgets.userId, schema.budgets.categoryId, schema.budgets.currency],
      set: { amount: toAmount(body.amount) },
    })
    .returning()

  return budget
})
