import { db, schema } from '@nuxthub/db'
import { and, count, desc, eq, gte, isNull, lte, sql, sum } from 'drizzle-orm'
import { subMonths } from 'date-fns'
import type { AccountType, TransactionType } from '~~/shared/schemas'
import { isLiabilityType } from '~~/shared/schemas'

// 'yyyy-MM' month bucket for grouping transactions in SQL. The date column is a
// pg `date`, so to_char is exact (no timezone involved).
export function monthExpr(t: typeof schema.transactions) {
  return sql<string>`to_char(${t.date}, 'YYYY-MM')`
}

/** The last `n` 'yyyy-MM' labels ending at the current month, oldest first (UTC). */
export function lastMonths(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => toDateStr(subMonths(now, n - 1 - i)).slice(0, 7))
}

/** First/last day of a 'yyyy-MM' month as 'yyyy-MM-dd' bounds for date-column filters. */
export function monthBounds(month: string): { from: string, to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number]
  // Day 0 of the next month = last day of this month; UTC to match toDateStr.
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

// Chart buckets for the net-worth-by-type breakdown. Coarser than the 9 account
// types (a stacked chart with 9 series is unreadable) but finer than asset/liability.
export const netWorthGroups = ['cash', 'investments', 'property', 'liabilities'] as const
export type NetWorthGroup = (typeof netWorthGroups)[number]

export function netWorthGroupOf(type: AccountType): NetWorthGroup {
  if (isLiabilityType(type)) return 'liabilities'
  if (type === 'CASH') return 'cash'
  if (type === 'INVESTMENT' || type === 'CRYPTO') return 'investments'
  return 'property' // PROPERTY, VEHICLE, OTHER_ASSET
}

export interface CashflowRow {
  month: string
  currency: string
  income: number
  expenses: number
  net: number
  savingsRate: number | null
}

/**
 * Monthly income vs expenses (and the savings rate they imply) per currency,
 * over the trailing `monthsCount` window. Transfers are excluded — moving
 * money between own accounts is neither income nor spending; fee rows stay in.
 * Zero-fills every month of the window for each present currency.
 * Shared by the cashflow endpoint and the AI digest context (server/utils/digest.ts).
 */
export async function computeCashflow(userId: string, monthsCount: number): Promise<CashflowRow[]> {
  const months = lastMonths(monthsCount)
  const t = schema.transactions
  const month = monthExpr(t)
  const sums = await db
    .select({ month, currency: t.currency, type: t.type, total: sum(t.amount) })
    .from(t)
    .where(and(eq(t.userId, userId), gte(t.date, `${months[0]}-01`), isNull(t.transferId)))
    .groupBy(month, t.currency, t.type)

  const byKey = new Map<string, { income: number, expenses: number }>()
  const currencies = new Set<string>()
  for (const s of sums) {
    currencies.add(s.currency)
    const key = `${s.month}:${s.currency}`
    const entry = byKey.get(key) ?? { income: 0, expenses: 0 }
    entry[s.type === 'INCOME' ? 'income' : 'expenses'] += Number(s.total ?? 0)
    byKey.set(key, entry)
  }

  return [...currencies].flatMap(currency => months.map((m) => {
    const entry = byKey.get(`${m}:${currency}`) ?? { income: 0, expenses: 0 }
    const net = entry.income - entry.expenses
    return {
      month: m,
      currency,
      income: entry.income,
      expenses: entry.expenses,
      net,
      savingsRate: entry.income > 0 ? net / entry.income : null,
    }
  }))
}

export interface SpendingTotalRow {
  currency: string
  categoryId: string | null
  name: string | null
  slug: string | null
  icon: string | null
  total: number
  count: number
}

/**
 * Per-category totals for one month and one transaction type. Shared by the
 * spending endpoint (called three times: current/prev-month/prev-year) and the
 * AI digest context.
 */
export async function computeSpendingTotals(userId: string, month: string, type: TransactionType): Promise<SpendingTotalRow[]> {
  const { from, to } = monthBounds(month)
  const t = schema.transactions
  const rows = await db
    .select({
      currency: t.currency,
      categoryId: t.categoryId,
      name: schema.categories.name,
      slug: schema.categories.slug,
      icon: schema.categories.icon,
      total: sum(t.amount),
      count: count(),
    })
    .from(t)
    .leftJoin(schema.categories, eq(t.categoryId, schema.categories.id))
    // Transfer legs move money between own accounts — not income/spending.
    .where(and(eq(t.userId, userId), eq(t.type, type), isNull(t.transferId), gte(t.date, from), lte(t.date, to)))
    .groupBy(t.currency, t.categoryId, schema.categories.name, schema.categories.slug, schema.categories.icon)
    .orderBy(desc(sum(t.amount)))

  return rows.map(r => ({ ...r, total: Number(r.total ?? 0) }))
}
