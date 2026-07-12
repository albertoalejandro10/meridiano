import { db, schema } from '@nuxthub/db'
import { transferSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, transferSchema.parse)

  const [from, to] = await Promise.all([
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, body.fromAccountId), eq(a.userId, userId)) }),
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, body.toAccountId), eq(a.userId, userId)) }),
  ])
  if (!from || !to) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (from.archived || to.archived) {
    throw createError({ statusCode: 400, statusMessage: 'Archived accounts cannot take part in a transfer' })
  }
  if (from.currency !== to.currency) {
    throw createError({ statusCode: 400, statusMessage: 'Transfer accounts must use the same currency' })
  }

  // A transfer is a linked pair: an EXPENSE on the source + an INCOME on the
  // destination sharing a transferId, so per-account balances work unchanged.
  const transferId = crypto.randomUUID()
  const incomeId = crypto.randomUUID()
  const date = toDateStr(body.date)
  const amount = toAmount(body.amount)
  const description = body.description ?? null

  const rows: (typeof schema.transactions.$inferInsert)[] = [
    { userId, accountId: from.id, transferId, type: 'EXPENSE', amount, currency: from.currency, date, description },
    { id: incomeId, userId, accountId: to.id, transferId, type: 'INCOME', amount, currency: to.currency, date, description },
  ]
  // The fee is deducted from what arrives: an EXPENSE on the destination linked
  // to the INCOME leg (transferId stays NULL so it counts as a real expense).
  if (body.fee) {
    rows.push({
      userId,
      accountId: to.id,
      categoryId: await ensureFeesCategory(userId),
      type: 'EXPENSE',
      amount: toAmount(body.fee),
      currency: to.currency,
      date,
      description: 'Transfer fee',
      feeOfId: incomeId,
    })
  }
  // One multi-row insert is atomic; FKs are checked at statement end, so the
  // fee row may reference the income leg created in the same statement.
  await db.insert(schema.transactions).values(rows)

  return { ok: true, transferId }
})
