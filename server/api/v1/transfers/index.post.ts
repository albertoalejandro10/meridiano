import { db, schema } from '@nuxthub/db'
import { transferSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, transferSchema.parse)

  const [from, to] = await Promise.all([
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, body.fromAccountId), eq(a.userId, userId)) }),
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, body.toAccountId), eq(a.userId, userId)) }),
  ])
  if (!from || !to) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (from.archived || to.archived) {
    throw createError({ statusCode: 400, statusMessage: 'Archived accounts cannot take part in a transfer' })
  }
  // Cross-currency transfers carry the exact amount landing on the destination
  // (in its currency); the FX rate stays implicit in the pair. Same-currency
  // transfers ignore a stray receivedAmount, so the external fee is re-checked
  // here against the leg it actually nets from.
  const crossCurrency = from.currency !== to.currency
  if (crossCurrency && !body.receivedAmount) {
    throw createError({ statusCode: 400, statusMessage: 'Received amount is required when currencies differ' })
  }
  const destinationAmount = crossCurrency ? body.receivedAmount! : body.amount
  if (body.externalFee && body.externalFee >= destinationAmount) {
    throw createError({ statusCode: 400, statusMessage: 'External fee must be less than the received amount' })
  }

  // A transfer is a linked pair: an EXPENSE on the source + an INCOME on the
  // destination sharing a transferId, so per-account balances work unchanged.
  const transferId = crypto.randomUUID()
  const expenseId = crypto.randomUUID()
  const incomeId = crypto.randomUUID()
  const date = toDateStr(body.date)
  const amount = toAmount(body.amount)
  const description = body.description ?? null

  const rows: (typeof schema.transactions.$inferInsert)[] = [
    { id: expenseId, userId, accountId: from.id, transferId, type: 'EXPENSE', amount, currency: from.currency, date, description },
    { id: incomeId, userId, accountId: to.id, transferId, type: 'INCOME', amount: toAmount(destinationAmount), currency: to.currency, date, description },
  ]
  // The internal fee is what the source platform charges to send: an EXPENSE on
  // the source, on top of the amount, linked to the EXPENSE leg. The external
  // fee is lost in transit: an EXPENSE on the destination linked to the INCOME
  // leg, so it nets amount − externalFee. transferId stays NULL on both so
  // they count as real expenses.
  const feesCategoryId = (body.internalFee || body.externalFee) ? await ensureFeesCategory(userId) : null
  if (body.internalFee) {
    rows.push({
      userId,
      accountId: from.id,
      categoryId: feesCategoryId,
      type: 'EXPENSE',
      amount: toAmount(body.internalFee),
      currency: from.currency,
      date,
      description: 'Internal transfer fee',
      feeOfId: expenseId,
      feeKind: 'INTERNAL',
    })
  }
  if (body.externalFee) {
    rows.push({
      userId,
      accountId: to.id,
      categoryId: feesCategoryId,
      type: 'EXPENSE',
      amount: toAmount(body.externalFee),
      currency: to.currency,
      date,
      description: 'External transfer fee',
      feeOfId: incomeId,
      feeKind: 'EXTERNAL',
    })
  }
  // One multi-row insert is atomic; FKs are checked at statement end, so the
  // fee row may reference the income leg created in the same statement.
  await db.insert(schema.transactions).values(rows)

  return { ok: true, transferId }
})
