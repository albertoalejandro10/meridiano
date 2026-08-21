import { db, schema } from '@nuxthub/db'
import { desc, eq, max, sum } from 'drizzle-orm'
import { isLiabilityType } from '~~/shared/schemas'

/**
 * Signed contribution of a transaction total to its account's balance.
 *
 * Assets hold what you have, so an EXPENSE reduces it. Liabilities hold a
 * positive "amount owed", so the sign flips: a charge (EXPENSE) grows the debt
 * and a payment (the INCOME leg of a transfer) shrinks it.
 *
 * Single source of truth for the direction of money — every derived balance,
 * anywhere, goes through here.
 */
export function signedAmount(accountType: string, type: string, amount: number): number {
  const expenseSign = isLiabilityType(accountType) ? 1 : -1
  return type === 'EXPENSE' ? expenseSign * amount : -expenseSign * amount
}

export interface MonthlySum {
  month: string
  type: string
  amount: number
}

export interface ReplayPoint {
  month: string
  value: number
  // False for months before the account existed — callers skip those so an
  // account created mid-window doesn't retroactively lift earlier months.
  active: boolean
}

/**
 * Replay an account's monthly transaction sums into a running end-of-month
 * balance across `months` (oldest first). Balances are never stored, so every
 * historical series is reconstructed this way: start at `initialBalance`,
 * collapse all pre-window activity into that starting value, then walk the
 * window accumulating each month's signed total.
 *
 * `sums` may cover the account's whole history — anything outside the window is
 * folded into the starting value rather than emitted.
 *
 * Shared by the net-worth history and per-account stats endpoints, which differ
 * only in what they do with each point.
 */
export function replayMonthlyBalance(
  account: { type: string, initialBalance: string | number, createdAt: Date },
  sums: MonthlySum[],
  months: string[],
): ReplayPoint[] {
  const windowStart = months[0]
  if (!windowStart) return []

  // The account exists from its creation month, or from its earliest backdated
  // transaction if that came first.
  const createdMonth = toDateStr(account.createdAt).slice(0, 7)
  const firstTxMonth = sums.reduce<string | null>((min, s) => (!min || s.month < min ? s.month : min), null)
  const startMonth = firstTxMonth && firstTxMonth < createdMonth ? firstTxMonth : createdMonth

  let value = Number(account.initialBalance)
  for (const s of sums) {
    if (s.month < windowStart) value += signedAmount(account.type, s.type, s.amount)
  }

  return months.map((month) => {
    for (const s of sums) {
      if (s.month === month) value += signedAmount(account.type, s.type, s.amount)
    }
    return { month, value, active: month >= startMonth }
  })
}

type Account = typeof schema.accounts.$inferSelect
export type AccountWithBalance = Account & {
  balance: number
  // 'yyyy-MM-dd' of the newest registered transaction; null = none yet.
  lastTransactionDate: string | null
  // Latest reconciliation checkpoint ("real balance was X on date D"); null = never reconciled.
  lastReconciliation: { date: string, statedBalance: number } | null
}

/**
 * The user's accounts with their *derived* balance (balances are never stored).
 *
 * Asset:     balance = initialBalance + Σ(INCOME) − Σ(EXPENSE)
 * Liability: balance = initialBalance + Σ(EXPENSE) − Σ(INCOME)  (positive "amount owed")
 *
 * Also carries per-account freshness data (last transaction date, latest
 * reconciliation checkpoint) so the UI can flag accounts that fell behind.
 *
 * Single source of truth shared by the accounts and goals endpoints.
 */
export async function accountsWithBalance(userId: string): Promise<AccountWithBalance[]> {
  const [accounts, sums, reconciliations] = await Promise.all([
    db.query.accounts.findMany({
      where: (a, { eq }) => eq(a.userId, userId),
      orderBy: (a, { asc }) => asc(a.createdAt),
    }),
    db
      .select({
        accountId: schema.transactions.accountId,
        type: schema.transactions.type,
        total: sum(schema.transactions.amount),
        lastDate: max(schema.transactions.date),
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .groupBy(schema.transactions.accountId, schema.transactions.type),
    // Latest checkpoint per account (DISTINCT ON keeps the first row of each
    // accountId group under the given order).
    db
      .selectDistinctOn([schema.accountReconciliations.accountId], {
        accountId: schema.accountReconciliations.accountId,
        date: schema.accountReconciliations.date,
        statedBalance: schema.accountReconciliations.statedBalance,
      })
      .from(schema.accountReconciliations)
      .where(eq(schema.accountReconciliations.userId, userId))
      .orderBy(
        schema.accountReconciliations.accountId,
        desc(schema.accountReconciliations.date),
        desc(schema.accountReconciliations.createdAt),
      ),
  ])

  return accounts.map((account) => {
    let balance = Number(account.initialBalance)
    let lastTransactionDate: string | null = null
    for (const s of sums) {
      if (s.accountId !== account.id) continue
      balance += signedAmount(account.type, s.type, Number(s.total ?? 0))
      if (s.lastDate && (!lastTransactionDate || s.lastDate > lastTransactionDate)) lastTransactionDate = s.lastDate
    }
    const rec = reconciliations.find(r => r.accountId === account.id)
    return {
      ...account,
      balance,
      lastTransactionDate,
      lastReconciliation: rec ? { date: rec.date, statedBalance: Number(rec.statedBalance) } : null,
    }
  })
}
