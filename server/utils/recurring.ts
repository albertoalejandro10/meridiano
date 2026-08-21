import { db, schema } from '@nuxthub/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Cadence } from '~~/shared/schemas'
import { differenceInCalendarDays } from 'date-fns'

export interface RecurringSourceTx {
  id: string
  date: string // 'yyyy-MM-dd'
  amount: number
  currency: string
  description: string | null
  categoryId: string | null
}

// Alias of the shared tuple so detection and scheduled templates can't diverge.
export type RecurringCadence = Cadence

export interface RecurringItem {
  name: string
  currency: string
  categoryId: string | null
  cadence: RecurringCadence
  averageAmount: number
  lastAmount: number
  lastDate: string
  nextExpectedDate: string
  occurrences: number
  monthlyEquivalent: number
  active: boolean
  recent: { id: string, date: string, amount: number }[]
}

const MIN_OCCURRENCES = 3
const AMOUNT_TOLERANCE = 0.25 // price bumps happen; ±25% of the median still "same bill"
const REGULARITY = 0.7 // share of gaps that must land inside the cadence tolerance

// Median gap (days) → cadence, with a per-cadence tolerance for step 5's
// regularity check. Gaps outside every band mean "not recurring".
const CADENCES: { cadence: RecurringCadence, min: number, max: number, tolerance: number }[] = [
  { cadence: 'WEEKLY', min: 6, max: 8, tolerance: 2 },
  { cadence: 'BIWEEKLY', min: 12, max: 16, tolerance: 4 },
  { cadence: 'MONTHLY', min: 26, max: 35, tolerance: 5 },
  { cadence: 'QUARTERLY', min: 80, max: 100, tolerance: 10 },
  { cadence: 'YEARLY', min: 330, max: 400, tolerance: 20 },
]

// Merchant identity: "Netflix #4821 03/26" and "netflix" should group together.
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[\d]+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return toDateStr(d)
}

/**
 * Detect recurring expenses (subscriptions/bills) from raw transactions, purely
 * computed — nothing is stored. Groups by normalized description per currency,
 * then requires ≥3 similar amounts at a steady cadence (weekly…yearly).
 * Input must be EXPENSE rows only, transfers and fee rows already excluded.
 */
export function detectRecurring(txns: RecurringSourceTx[], todayStr: string): RecurringItem[] {
  const groups = new Map<string, RecurringSourceTx[]>()
  for (const tx of txns) {
    const normalized = tx.description ? normalizeDescription(tx.description) : ''
    if (!normalized) continue // no merchant identity to group on
    const key = `${tx.currency}:${normalized}`
    const group = groups.get(key)
    if (group) group.push(tx)
    else groups.set(key, [tx])
  }

  const items: RecurringItem[] = []
  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue

    const medianAmount = median(group.map(tx => tx.amount))
    let rows = group.filter(tx => Math.abs(tx.amount - medianAmount) <= medianAmount * AMOUNT_TOLERANCE)
    if (rows.length < MIN_OCCURRENCES) continue

    // Callers pass rows ordered by date asc; collapse same-day duplicates (e.g.
    // a double charge) into one occurrence so they don't produce zero gaps.
    rows = rows.filter((tx, i) => i === 0 || tx.date !== rows[i - 1]!.date)
    if (rows.length < MIN_OCCURRENCES) continue

    const gaps = rows.slice(1).map((tx, i) =>
      differenceInCalendarDays(new Date(`${tx.date}T00:00:00Z`), new Date(`${rows[i]!.date}T00:00:00Z`)))
    const medianGap = median(gaps)
    const band = CADENCES.find(c => medianGap >= c.min && medianGap <= c.max)
    if (!band) continue

    const regular = gaps.filter(g => Math.abs(g - medianGap) <= band.tolerance).length / gaps.length
    if (regular < REGULARITY) continue

    // Display name: the most frequent original description in the group.
    const nameCounts = new Map<string, number>()
    for (const tx of rows) nameCounts.set(tx.description!, (nameCounts.get(tx.description!) ?? 0) + 1)
    const name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0]

    const last = rows[rows.length - 1]!
    const averageAmount = rows.reduce((sum, tx) => sum + tx.amount, 0) / rows.length
    items.push({
      name,
      currency: last.currency,
      categoryId: last.categoryId,
      cadence: band.cadence,
      averageAmount,
      lastAmount: last.amount,
      lastDate: last.date,
      nextExpectedDate: addDays(last.date, Math.round(medianGap)),
      occurrences: rows.length,
      monthlyEquivalent: averageAmount * 30.44 / medianGap,
      // Considered lapsed once 1.5 cycles pass without a new charge.
      active: todayStr <= addDays(last.date, Math.round(medianGap * 1.5)),
      recent: rows.slice(-6).map(tx => ({ id: tx.id, date: tx.date, amount: tx.amount })),
    })
  }

  return items.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent)
}

/**
 * Fetch the user's expense history and run detection over it. Shared by the
 * recurring endpoint (which further enriches items with category name/slug/icon)
 * and the AI digest context, which uses the bare items as-is.
 */
export async function gatherRecurringItems(userId: string): Promise<RecurringItem[]> {
  const t = schema.transactions
  const expenses = await db
    .select({
      id: t.id,
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      categoryId: t.categoryId,
    })
    .from(t)
    // Fee rows excluded: transfer/sale commissions would surface as noisy
    // pseudo-merchants, not bills the user chose to pay repeatedly.
    .where(and(eq(t.userId, userId), eq(t.type, 'EXPENSE'), isNull(t.transferId), isNull(t.feeOfId)))
    .orderBy(asc(t.date), asc(t.createdAt))

  return detectRecurring(
    expenses.map(e => ({ ...e, amount: Number(e.amount) })),
    toDateStr(new Date()),
  )
}
