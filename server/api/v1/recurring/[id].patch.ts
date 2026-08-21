import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { recurringUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, recurringUpdateSchema.parse)

  const existing = await db.query.recurringTransactions.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, id), eq(r.userId, userId)),
    columns: { id: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Recurring payment not found' })

  if (body.accountId) {
    const account = await db.query.accounts.findFirst({
      where: (a, { and, eq }) => and(eq(a.id, body.accountId!), eq(a.userId, userId)),
      columns: { id: true },
    })
    if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }
  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  // Pulled out of the spread so the Date/number values never reach `.set()`
  // untranslated, and re-added only when actually sent — the schema is
  // `.partial()`, and writing `undefined` keys would blank stored values.
  const { amount, startDate, endDate, ...rest } = body

  await db
    .update(schema.recurringTransactions)
    .set({
      ...rest,
      ...(amount !== undefined && { amount: amount == null ? null : toAmount(amount) }),
      ...(startDate !== undefined && { startDate: toDateStr(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? toDateStr(endDate) : null }),
    })
    .where(eq(schema.recurringTransactions.id, id))

  // Changing startDate/cadence re-derives every due date. Answered occurrences
  // keep their old dueDate, so any that no longer line up simply come due again
  // — deliberate: the user is asked rather than silently losing a period.
  return db.query.recurringTransactions.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: { account: true, category: true },
  })
})
