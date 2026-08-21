import { db, schema } from '@nuxthub/db'
import { eq, sum } from 'drizzle-orm'
import { analyticsRangeQuerySchema } from '~~/shared/schemas'
import type { NetWorthGroup } from '~~/server/utils/analytics'

// Month-end net worth split by account-type group, per currency. Balances are
// never stored, so history is reconstructed the same way current balances are
// derived (see server/utils/balances.ts): initialBalance plus a running sum of
// signed monthly transaction totals. Archived accounts are excluded, matching
// the dashboard's current net-worth figure.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, analyticsRangeQuerySchema.parse)

  const t = schema.transactions
  const month = monthExpr(t)
  const [accounts, sums] = await Promise.all([
    db.query.accounts.findMany({
      where: (a, { and, eq }) => and(eq(a.userId, userId), eq(a.archived, false)),
    }),
    // All history, not just the window: pre-window activity feeds each
    // account's starting level.
    db
      .select({ accountId: t.accountId, month, type: t.type, total: sum(t.amount) })
      .from(t)
      .where(eq(t.userId, userId))
      .groupBy(t.accountId, month, t.type),
  ])

  const months = lastMonths(q.months)

  // rows[currency][month] = per-group running totals
  const buckets = new Map<string, Map<string, Record<NetWorthGroup, number>>>()
  const bucketFor = (currency: string, m: string) => {
    let byMonth = buckets.get(currency)
    if (!byMonth) {
      byMonth = new Map()
      buckets.set(currency, byMonth)
    }
    let bucket = byMonth.get(m)
    if (!bucket) {
      bucket = { cash: 0, investments: 0, property: 0, liabilities: 0 }
      byMonth.set(m, bucket)
    }
    return bucket
  }

  for (const account of accounts) {
    const accountSums = sums
      .filter(s => s.accountId === account.id)
      .map(s => ({ month: s.month, type: s.type, amount: Number(s.total ?? 0) }))

    // Months before the account existed contribute nothing, so an account
    // created mid-window doesn't retroactively lift earlier months.
    const group = netWorthGroupOf(account.type)
    for (const point of replayMonthlyBalance(account, accountSums, months)) {
      if (point.active) bucketFor(account.currency, point.month)[group] += point.value
    }
  }

  const rows = [...buckets.entries()].flatMap(([currency, byMonth]) =>
    months.map((m) => {
      const b = byMonth.get(m) ?? { cash: 0, investments: 0, property: 0, liabilities: 0 }
      return {
        month: m,
        currency,
        ...b,
        // Liabilities stay positive "amount owed" here; the chart negates them.
        netWorth: b.cash + b.investments + b.property - b.liabilities,
      }
    }),
  )

  return { rows }
})
