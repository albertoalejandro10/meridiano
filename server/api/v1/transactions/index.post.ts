import { db, schema } from '@nuxthub/db'
import { transactionSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, transactionSchema.parse)

  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, body.accountId), eq(a.userId, userId)),
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  // Auto-categorization rules only fill a missing category — an explicit
  // user choice (including "no category" with no description) is never overridden.
  if (!body.categoryId && body.description) {
    body.categoryId = matchCategory(body.description, body.type, await getActiveRules(userId)) ?? undefined
  }

  const { amount, date, internalFee, externalFee, ...rest } = body
  const id = crypto.randomUUID()
  const rows: (typeof schema.transactions.$inferInsert)[] = [{
    ...rest,
    id,
    amount: toAmount(amount),
    date: toDateStr(date),
    currency: account.currency,
    userId,
  }]
  // Optional fees: linked EXPENSE rows on the same account (e.g. a receiving
  // fee on an income), removed with their parent via the feeOfId cascade.
  const feesCategoryId = (internalFee || externalFee) ? await ensureFeesCategory(userId) : null
  const feeRow = (kind: 'INTERNAL' | 'EXTERNAL', fee: number) => ({
    userId,
    accountId: account.id,
    categoryId: feesCategoryId,
    type: 'EXPENSE' as const,
    amount: toAmount(fee),
    currency: account.currency,
    date: toDateStr(date),
    description: kind === 'INTERNAL' ? 'Internal fee' : 'External fee',
    feeOfId: id,
    feeKind: kind,
  })
  if (internalFee) rows.push(feeRow('INTERNAL', internalFee))
  if (externalFee) rows.push(feeRow('EXTERNAL', externalFee))
  await db.insert(schema.transactions).values(rows)

  return db.query.transactions.findFirst({
    where: (tx, { eq }) => eq(tx.id, id),
    with: { account: true, category: true },
  })
})
