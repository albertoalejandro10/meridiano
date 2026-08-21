import { analyticsSpendingQuerySchema } from '~~/shared/schemas'

interface SpendingRow {
  currency: string
  categoryId: string | null
  name: string | null
  // Seeded categories are rendered from the slug (categories.defaults.<slug>);
  // `name` is the fallback for ones the user created.
  slug: string | null
  icon: string | null
  total: number
  count: number
  prevMonthTotal: number
  prevYearTotal: number
}

// Per-category totals for one month, with the same category's totals a month
// and a year earlier — one response powers the breakdown donut, the trends
// table, and (with type=INCOME) the income-sources card. See
// computeSpendingTotals (server/utils/analytics.ts) for the single-month
// query — also reused by the AI digest context.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, analyticsSpendingQuerySchema.parse)

  const month = q.month ?? lastMonths(1)[0]!
  const [year, mon] = month.split('-').map(Number) as [number, number]
  const prevMonth = toDateStr(new Date(Date.UTC(year, mon - 2, 1))).slice(0, 7)
  const prevYear = `${year - 1}-${String(mon).padStart(2, '0')}`

  const [current, previous, yearAgo] = await Promise.all([
    computeSpendingTotals(userId, month, q.type),
    computeSpendingTotals(userId, prevMonth, q.type),
    computeSpendingTotals(userId, prevYear, q.type),
  ])

  const rows = new Map<string, SpendingRow>()
  const rowFor = (r: { currency: string, categoryId: string | null, name: string | null, slug: string | null, icon: string | null }) => {
    const key = `${r.currency}:${r.categoryId ?? 'none'}`
    let row = rows.get(key)
    if (!row) {
      row = { currency: r.currency, categoryId: r.categoryId, name: r.name, slug: r.slug, icon: r.icon, total: 0, count: 0, prevMonthTotal: 0, prevYearTotal: 0 }
      rows.set(key, row)
    }
    return row
  }

  for (const r of current) {
    const row = rowFor(r)
    row.total = r.total
    row.count = r.count
  }
  for (const r of previous) rowFor(r).prevMonthTotal = r.total
  for (const r of yearAgo) rowFor(r).prevYearTotal = r.total

  return { month, rows: [...rows.values()].sort((a, b) => b.total - a.total) }
})
