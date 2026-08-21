import { db } from '@nuxthub/db'
import type { AccountWithBalance } from './balances'
import type { CashflowRow } from './analytics'

export interface DigestNetWorth {
  currency: string
  cash: number
  investments: number
  property: number
  liabilities: number
  netWorth: number
}

export interface DigestSpendingCategory {
  currency: string
  category: string
  total: number
}

export interface DigestRecurringItem {
  name: string
  currency: string
  cadence: string
  monthlyEquivalent: number
}

export interface DigestProfile {
  jobTitle?: string
  income?: number
  incomeCurrency?: string
  employmentType?: string
  maritalStatus?: string
  dependents?: number
  riskTolerance?: string
  financialNotes?: string
}

export interface DigestContext {
  today: string
  // Net worth (and its cash/investments/property/liabilities breakdown) per
  // currency — amounts in different currencies are never combined (see
  // sumByCurrency in app/utils/index.ts; the same rule applies here).
  netWorth: DigestNetWorth[]
  cashflow: CashflowRow[]
  topSpending: DigestSpendingCategory[]
  recurring: DigestRecurringItem[]
  // Optional Settings → Financial profile context, omitted entirely when the user
  // hasn't filled either field — additive only, never required for the digest.
  profile?: DigestProfile
}

const TOP_SPENDING_LIMIT = 8
const TOP_RECURRING_LIMIT = 10
const CASHFLOW_MONTHS = 3

function summarizeNetWorth(accounts: AccountWithBalance[]): DigestNetWorth[] {
  const byCurrency = new Map<string, DigestNetWorth>()
  for (const account of accounts) {
    if (account.archived) continue
    const entry = byCurrency.get(account.currency) ?? {
      currency: account.currency,
      cash: 0,
      investments: 0,
      property: 0,
      liabilities: 0,
      netWorth: 0,
    }
    const group = netWorthGroupOf(account.type)
    entry[group] += account.balance
    entry.netWorth += group === 'liabilities' ? -account.balance : account.balance
    byCurrency.set(account.currency, entry)
  }
  return [...byCurrency.values()]
}

/**
 * Compact, structured snapshot of a user's finances, built entirely from
 * already-computed utils (never re-derives balances/aggregations) — the
 * context object handed to Claude for the "explain my finances" digest.
 * Category/merchant names stay in whatever language they're stored in; the
 * model is instructed to write its response in the requested locale regardless.
 */
export async function gatherDigestContext(userId: string): Promise<DigestContext> {
  const currentMonth = lastMonths(1)[0]!
  const [accounts, cashflow, spending, recurring, user] = await Promise.all([
    accountsWithBalance(userId),
    computeCashflow(userId, CASHFLOW_MONTHS),
    computeSpendingTotals(userId, currentMonth, 'EXPENSE'),
    gatherRecurringItems(userId),
    db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: {
        jobTitle: true,
        income: true,
        incomeCurrency: true,
        employmentType: true,
        maritalStatus: true,
        dependents: true,
        riskTolerance: true,
        financialNotes: true,
      },
    }),
  ])

  const topSpending = spending
    .filter(row => row.total > 0)
    .slice(0, TOP_SPENDING_LIMIT)
    .map(row => ({
      currency: row.currency,
      category: row.name ?? row.slug ?? 'Uncategorized',
      total: row.total,
    }))

  const activeRecurring = recurring
    .filter(item => item.active)
    .slice(0, TOP_RECURRING_LIMIT)
    .map(item => ({
      name: item.name,
      currency: item.currency,
      cadence: item.cadence,
      monthlyEquivalent: Math.round(item.monthlyEquivalent * 100) / 100,
    }))

  const profile: DigestProfile = {}
  if (user?.jobTitle) profile.jobTitle = user.jobTitle
  if (user?.income != null) {
    profile.income = Number(user.income)
    if (user.incomeCurrency) profile.incomeCurrency = user.incomeCurrency
  }
  if (user?.employmentType) profile.employmentType = user.employmentType
  if (user?.maritalStatus) profile.maritalStatus = user.maritalStatus
  if (user?.dependents != null) profile.dependents = user.dependents
  if (user?.riskTolerance) profile.riskTolerance = user.riskTolerance
  if (user?.financialNotes) profile.financialNotes = user.financialNotes

  return {
    today: toDateStr(new Date()),
    netWorth: summarizeNetWorth(accounts),
    cashflow,
    topSpending,
    recurring: activeRecurring,
    ...(Object.keys(profile).length > 0 && { profile }),
  }
}
