import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { budgetIncomeSchema } from '~~/shared/schemas'

// Set (or clear, with amount: null) the expected monthly income for one
// currency — the amount envelope mode allocates across categories.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, budgetIncomeSchema.parse)

  if (body.amount === null) {
    await db
      .delete(schema.budgetIncomes)
      .where(and(eq(schema.budgetIncomes.userId, userId), eq(schema.budgetIncomes.currency, body.currency)))
    return { ok: true }
  }

  const [income] = await db
    .insert(schema.budgetIncomes)
    .values({ userId, currency: body.currency, amount: toAmount(body.amount) })
    .onConflictDoUpdate({
      target: [schema.budgetIncomes.userId, schema.budgetIncomes.currency],
      set: { amount: toAmount(body.amount) },
    })
    .returning()

  return income
})
