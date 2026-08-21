import { db, schema } from '@nuxthub/db'
import { and, count, desc, eq, gte, isNull, sum } from 'drizzle-orm'
import { analyticsRangeQuerySchema } from '~~/shared/schemas'

// Everything the account detail page needs beyond the account row itself:
// balance history, monthly money in/out, per-category totals, headline totals,
// and the full reconciliation history. Balances are never stored, so history is
// reconstructed the same way current balances are derived (see
// server/utils/balances.ts and analytics/net-worth-history.get.ts), at monthly
// granularity to match the range selector.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const accountId = getRouterParam(event, 'id')!
  const q = await getValidatedQuery(event, analyticsRangeQuerySchema.parse)

  const account = await db.query.accounts.findFirst({
    where: (a, { and, eq }) => and(eq(a.id, accountId), eq(a.userId, userId)),
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  const months = lastMonths(q.months)
  const windowStart = months[0]!
  const t = schema.transactions
  const month = monthExpr(t)

  const [sums, categoryRows, reconciliations] = await Promise.all([
    // All history, not just the window: pre-window activity feeds the balance
    // series' starting level. Transfers stay in — on a single account a transfer
    // leg is real money arriving or leaving.
    db
      .select({ month, type: t.type, total: sum(t.amount), count: count() })
      .from(t)
      .where(and(eq(t.userId, userId), eq(t.accountId, accountId)))
      .groupBy(month, t.type),
    // Per-category window totals. Transfer legs are excluded like
    // analytics/spending (moving money between own accounts isn't spending);
    // fee rows keep transferId NULL so they count.
    db
      .select({
        categoryId: t.categoryId,
        name: schema.categories.name,
        slug: schema.categories.slug,
        icon: schema.categories.icon,
        type: t.type,
        total: sum(t.amount),
        count: count(),
      })
      .from(t)
      .leftJoin(schema.categories, eq(t.categoryId, schema.categories.id))
      .where(and(eq(t.userId, userId), eq(t.accountId, accountId), isNull(t.transferId), gte(t.date, `${windowStart}-01`)))
      .groupBy(t.categoryId, schema.categories.name, schema.categories.slug, schema.categories.icon, t.type)
      .orderBy(desc(sum(t.amount))),
    db.query.accountReconciliations.findMany({
      where: (r, { and, eq }) => and(eq(r.accountId, accountId), eq(r.userId, userId)),
      orderBy: (r, { desc }) => [desc(r.date), desc(r.createdAt)],
    }),
  ])

  const monthly = sums.map(s => ({ month: s.month, type: s.type, amount: Number(s.total ?? 0), count: s.count }))

  // Months before the account existed produce no chart points.
  const series = replayMonthlyBalance(account, monthly, months)

  const todayStr = toDateStr(new Date())
  const currentMonth = todayStr.slice(0, 7)
  // One month-end point per month; the current month's point sits at today,
  // not the future month-end, so the series ends "now" at the live balance.
  const balanceHistory = series
    .filter(p => p.active)
    .map(p => ({ date: p.month === currentMonth ? todayStr : monthBounds(p.month).to, balance: p.value }))

  // Money in/out per window month, zero-filled for a continuous axis.
  const cashflow = months.map((m) => {
    const rows = monthly.filter(s => s.month === m)
    return {
      month: m,
      income: rows.filter(s => s.type === 'INCOME').reduce((n, s) => n + s.amount, 0),
      expenses: rows.filter(s => s.type === 'EXPENSE').reduce((n, s) => n + s.amount, 0),
    }
  })

  const thisMonth = cashflow[cashflow.length - 1]!
  // Average only over months the account existed, so a young account isn't
  // diluted by empty leading months.
  const activeMonths = series.filter(p => p.active).length || 1

  return {
    balanceHistory,
    cashflow,
    categories: categoryRows.map(c => ({
      categoryId: c.categoryId,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      type: c.type,
      total: Number(c.total ?? 0),
      count: c.count,
    })),
    totals: {
      transactionCount: monthly.reduce((n, s) => n + s.count, 0),
      thisMonthIncome: thisMonth.income,
      thisMonthExpenses: thisMonth.expenses,
      avgMonthlyNet: cashflow.reduce((n, r) => n + r.income - r.expenses, 0) / activeMonths,
    },
    reconciliations: reconciliations.map(r => ({ date: r.date, statedBalance: Number(r.statedBalance) })),
  }
})
