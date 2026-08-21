import { db, schema } from '@nuxthub/db'
import { and, eq, gte, isNotNull, isNull, ne, sum } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

// What it costs this user to move their own money around: the exchange rate
// their cross-currency transfers actually realised, and the fees each route
// charged. Both are derived from the existing transfer pair + fee rows — no
// rate is ever stored (see the transfers endpoint) and no fee is ever summed
// across currencies, so this stays inside the app's "never add currencies"
// rule: a rate is a ratio, not a total.

/** Start of the trailing `monthsCount` window as a 'yyyy-MM-dd' bound. */
function windowStart(monthsCount: number): string {
  return `${lastMonths(monthsCount)[0]}-01`
}

export interface ConversionRow {
  date: string
  fromAccount: string
  toAccount: string
  sentAmount: number
  sentCurrency: string
  receivedAmount: number
  receivedCurrency: string
  /** Destination units per source unit, e.g. 885.63 VES per USD. */
  impliedRate: number
}

/**
 * Every cross-currency transfer in the window, with the rate it implied.
 * A transfer is a linked pair (EXPENSE leg on the source + INCOME leg on the
 * destination sharing a transferId), so the rate the user got is simply
 * `received / sent` — recoverable by joining the pair back together.
 * Same-currency transfers are excluded: their rate is 1 and says nothing.
 */
export async function computeConversions(userId: string, monthsCount: number): Promise<ConversionRow[]> {
  const expense = alias(schema.transactions, 'expense_leg')
  const income = alias(schema.transactions, 'income_leg')
  const source = alias(schema.accounts, 'source_account')
  const destination = alias(schema.accounts, 'destination_account')

  const rows = await db
    .select({
      date: expense.date,
      fromAccount: source.name,
      toAccount: destination.name,
      sentAmount: expense.amount,
      sentCurrency: expense.currency,
      receivedAmount: income.amount,
      receivedCurrency: income.currency,
    })
    .from(expense)
    .innerJoin(income, and(eq(income.transferId, expense.transferId), eq(income.type, 'INCOME')))
    .innerJoin(source, eq(source.id, expense.accountId))
    .innerJoin(destination, eq(destination.id, income.accountId))
    .where(and(
      eq(expense.userId, userId),
      eq(expense.type, 'EXPENSE'),
      isNotNull(expense.transferId),
      // Only pairs whose two legs are in different currencies imply a rate.
      ne(expense.currency, income.currency),
      gte(expense.date, windowStart(monthsCount)),
    ))
    .orderBy(expense.date)

  return rows.map((r) => {
    const sentAmount = Number(r.sentAmount)
    const receivedAmount = Number(r.receivedAmount)
    return {
      date: r.date,
      fromAccount: r.fromAccount,
      toAccount: r.toAccount,
      sentAmount,
      sentCurrency: r.sentCurrency,
      receivedAmount,
      receivedCurrency: r.receivedCurrency,
      impliedRate: sentAmount > 0 ? receivedAmount / sentAmount : 0,
    }
  })
}

export interface FeeRouteRow {
  /** 'Upwork → AirTM - USDC' for a transfer fee, or the account name alone. */
  route: string
  fromAccount: string | null
  toAccount: string | null
  isTransfer: boolean
  currency: string
  internal: number
  external: number
  total: number
  count: number
}

/**
 * Fees grouped by the route that charged them. A fee is an EXPENSE row linked
 * to its parent leg via feeOfId; when that parent belongs to a transfer, the
 * sibling leg names the other end of the route. Source/destination are read
 * off the legs' own types rather than the fee kind, so a fee is attributed
 * correctly regardless of which leg it hangs from.
 * Grouped per currency — totals are never combined across them.
 */
export async function computeFeeBreakdown(userId: string, monthsCount: number): Promise<FeeRouteRow[]> {
  const fee = alias(schema.transactions, 'fee')
  const parent = alias(schema.transactions, 'parent_leg')
  const sibling = alias(schema.transactions, 'sibling_leg')
  const parentAccount = alias(schema.accounts, 'parent_account')
  const siblingAccount = alias(schema.accounts, 'sibling_account')

  const rows = await db
    .select({
      amount: fee.amount,
      currency: fee.currency,
      feeKind: fee.feeKind,
      parentType: parent.type,
      parentTransferId: parent.transferId,
      parentAccount: parentAccount.name,
      siblingAccount: siblingAccount.name,
    })
    .from(fee)
    .innerJoin(parent, eq(parent.id, fee.feeOfId))
    .innerJoin(parentAccount, eq(parentAccount.id, parent.accountId))
    // Present only for fees on a transfer; a plain transaction's fee has no sibling.
    .leftJoin(sibling, and(
      isNotNull(parent.transferId),
      eq(sibling.transferId, parent.transferId),
      ne(sibling.id, parent.id),
    ))
    .leftJoin(siblingAccount, eq(siblingAccount.id, sibling.accountId))
    .where(and(
      eq(fee.userId, userId),
      isNotNull(fee.feeOfId),
      gte(fee.date, windowStart(monthsCount)),
    ))

  const byRoute = new Map<string, FeeRouteRow>()
  for (const r of rows) {
    const isTransfer = r.parentTransferId != null && r.siblingAccount != null
    // The EXPENSE leg is the source and the INCOME leg the destination,
    // whichever of the pair the fee happens to be attached to.
    const parentIsSource = r.parentType === 'EXPENSE'
    const fromAccount = isTransfer ? (parentIsSource ? r.parentAccount : r.siblingAccount) : null
    const toAccount = isTransfer ? (parentIsSource ? r.siblingAccount : r.parentAccount) : null
    const route = isTransfer ? `${fromAccount} → ${toAccount}` : r.parentAccount

    const key = `${route}:${r.currency}`
    let entry = byRoute.get(key)
    if (!entry) {
      entry = {
        route,
        fromAccount,
        toAccount,
        isTransfer,
        currency: r.currency,
        internal: 0,
        external: 0,
        total: 0,
        count: 0,
      }
      byRoute.set(key, entry)
    }
    const amount = Number(r.amount)
    entry[(r.feeKind ?? 'INTERNAL') === 'EXTERNAL' ? 'external' : 'internal'] += amount
    entry.total += amount
    entry.count += 1
  }

  return [...byRoute.values()].sort((a, b) => b.total - a.total)
}

export interface FeeDragRow {
  currency: string
  fees: number
  income: number
  /** Fees as a share of income earned in the same currency; null if no income. */
  drag: number | null
}

/**
 * What share of the income earned in a currency was spent on moving money.
 * Income excludes transfer legs (matching computeCashflow) so only real
 * earnings count in the denominator; fee rows themselves carry a NULL
 * transferId, so they never leak into it.
 */
export async function computeFeeDrag(userId: string, monthsCount: number): Promise<FeeDragRow[]> {
  const from = windowStart(monthsCount)
  const t = schema.transactions

  const [feeSums, incomeSums] = await Promise.all([
    db
      .select({ currency: t.currency, total: sum(t.amount) })
      .from(t)
      .where(and(eq(t.userId, userId), isNotNull(t.feeOfId), gte(t.date, from)))
      .groupBy(t.currency),
    db
      .select({ currency: t.currency, total: sum(t.amount) })
      .from(t)
      .where(and(eq(t.userId, userId), eq(t.type, 'INCOME'), isNull(t.transferId), gte(t.date, from)))
      .groupBy(t.currency),
  ])

  // Inferred as the currency enum, not string, so the Map lookups below type-check.
  const currencies = new Set([
    ...feeSums.map(r => r.currency),
    ...incomeSums.map(r => r.currency),
  ])
  const feeBy = new Map(feeSums.map(r => [r.currency, Number(r.total ?? 0)]))
  const incomeBy = new Map(incomeSums.map(r => [r.currency, Number(r.total ?? 0)]))

  return [...currencies]
    .map((currency) => {
      const fees = feeBy.get(currency) ?? 0
      const income = incomeBy.get(currency) ?? 0
      return { currency, fees, income, drag: income > 0 ? fees / income : null }
    })
    // Currencies that charged no fee have nothing to report here.
    .filter(r => r.fees > 0)
    .sort((a, b) => b.fees - a.fees)
}
