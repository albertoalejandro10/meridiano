import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { isLiabilityType, reconcileSchema } from '~~/shared/schemas'

// Record a reconciliation checkpoint: the account's real bank/platform balance
// on a date. The checkpoint itself is informational — the UI compares it against
// the derived balance so the user can spot unregistered transactions.
//
// With `applyAdjustment`, the difference is also *closed*: balances are derived,
// never stored, so the only way to move one is a transaction, and this writes
// that transaction. Meant for the gap you can't itemize (crypto dust, an
// untracked fee), not as a substitute for registering what you actually know.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const accountId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, reconcileSchema.parse)

  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, accountId), eq(a.userId, userId)),
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (account.archived) throw createError({ statusCode: 400, statusMessage: 'Archived accounts cannot be reconciled' })

  const date = toDateStr(body.date)
  const statedBalance = toAmount(body.statedBalance)

  // The gap is measured against the balance the *server* derives, never a
  // client-sent one, so the account lands exactly on the stated figure even if
  // the page was showing a stale balance. Under a cent there's nothing to
  // correct — and numeric(14, 2) couldn't hold the correction anyway.
  let adjustmentRow: typeof schema.transactions.$inferInsert | null = null
  if (body.applyAdjustment) {
    const current = (await accountsWithBalance(userId)).find(a => a.id === accountId)!
    const diff = Number((body.statedBalance - current.balance).toFixed(2))

    if (Math.abs(diff) >= 0.01) {
      adjustmentRow = {
        userId,
        accountId,
        categoryId: await ensureAdjustmentCategory(userId),
        // Which direction closes the gap: on an asset, more real money means
        // missing income; on a liability, owing more means a missing charge.
        // The mirror of signedAmount() in server/utils/balances.ts.
        type: isLiabilityType(account.type) === (diff > 0) ? 'EXPENSE' : 'INCOME',
        amount: toAmount(Math.abs(diff)),
        currency: account.currency,
        date,
        // No description on purpose: the row renders as its translated category
        // label, and server-side prose is English-only.
      }
    }
  }

  // One checkpoint per account per day: a re-confirmation (or a corrected
  // figure) replaces the day's row instead of stacking duplicates in the history.
  const existing = await db.query.accountReconciliations.findFirst({
    where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.accountId, accountId), eq(r.date, date)),
  })

  return db.transaction(async (tx) => {
    const [adjustment] = adjustmentRow
      ? await tx.insert(schema.transactions).values(adjustmentRow).returning()
      : []

    const [reconciliation] = existing
      ? await tx
          .update(schema.accountReconciliations)
          .set({ statedBalance })
          .where(and(eq(schema.accountReconciliations.id, existing.id), eq(schema.accountReconciliations.userId, userId)))
          .returning()
      : await tx
          .insert(schema.accountReconciliations)
          .values({ userId, accountId, statedBalance, date })
          .returning()

    return { reconciliation, adjustment: adjustment ?? null }
  })
})
