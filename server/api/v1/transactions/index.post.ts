import { db, schema } from '@nuxthub/db'
import { transactionSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, transactionSchema.parse)

  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, body.accountId), eq(a.userId, userId)),
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  const { amount, date, fee, ...rest } = body
  const id = crypto.randomUUID()
  const rows: (typeof schema.transactions.$inferInsert)[] = [{
    ...rest,
    id,
    amount: toAmount(amount),
    date: toDateStr(date),
    currency: account.currency,
    userId,
  }]
  // Optional fee: a linked EXPENSE on the same account (e.g. a receiving fee
  // on an income), removed with its parent via the feeOfId cascade.
  if (fee) {
    rows.push({
      userId,
      accountId: account.id,
      categoryId: await ensureFeesCategory(userId),
      type: 'EXPENSE',
      amount: toAmount(fee),
      currency: account.currency,
      date: toDateStr(date),
      description: 'Fee',
      feeOfId: id,
    })
  }
  await db.insert(schema.transactions).values(rows)

  return db.query.transactions.findFirst({
    where: (tx, { eq }) => eq(tx.id, id),
    with: { account: true, category: true },
  })
})
