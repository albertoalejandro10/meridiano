import { db, schema } from '@nuxthub/db'
import { recurringSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, recurringSchema.parse)

  // The FK alone would accept another user's ids — scope both explicitly.
  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, body.accountId), eq(a.userId, userId)),
    columns: { id: true },
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  const [template] = await db
    .insert(schema.recurringTransactions)
    .values({
      ...body,
      userId,
      // Optional estimate — null means "ask me every time, I have no guess".
      amount: body.amount == null ? null : toAmount(body.amount),
      startDate: toDateStr(body.startDate),
      endDate: body.endDate ? toDateStr(body.endDate) : null,
    })
    .returning()

  return db.query.recurringTransactions.findFirst({
    where: (r, { eq }) => eq(r.id, template!.id),
    with: { account: true, category: true },
  })
})
