import { addMonths } from 'date-fns'

/**
 * Pure client-side planning math for /app/planning. Nothing here is stored:
 * debt terms (APR, payment) are user inputs and projections are recomputed
 * from live balances on every change.
 */

/** Hard stop for projections — anything past 50 years reads as "never". */
export const PLAN_MONTHS_CAP = 600

export type PayoffStrategy = 'snowball' | 'avalanche'

export interface DebtInput {
  id: string
  /** Current amount owed (positive, from the derived liability balance) */
  balance: number
  /** Annual interest rate in percent (e.g. 22.9) */
  apr: number
  /** Monthly payment committed to this debt while it's open */
  payment: number
}

export interface PayoffPlan {
  /** Months until the last debt hits zero (equals the cap when paidOff is false) */
  months: number
  /** False when the payments never outrun interest within the cap */
  paidOff: boolean
  totalInterest: number
  /** Total remaining debt at the end of each month; index 0 is today */
  series: number[]
  /** Debts in the order they reach zero, with the month it happens (1-based) */
  payoffOrder: { id: string, month: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Classic rollover payoff simulation: every month each open debt accrues
 * interest and receives its own payment; the payments freed by closed debts
 * (plus `extraPerMonth`) pile onto one target — smallest balance first for
 * snowball, highest APR first for avalanche.
 */
export function simulateDebtPayoff(debts: DebtInput[], extraPerMonth: number, strategy: PayoffStrategy): PayoffPlan {
  const open = debts.filter(d => d.balance > 0).map(d => ({ ...d }))
  const series = [round2(open.reduce((sum, d) => sum + d.balance, 0))]
  const payoffOrder: { id: string, month: number }[] = []
  let totalInterest = 0
  // The pool stays constant across the whole plan: a closed debt's payment
  // rolls over to the next target instead of disappearing.
  const pool = debts.reduce((sum, d) => sum + d.payment, 0) + Math.max(extraPerMonth, 0)

  let month = 0
  while (open.length && month < PLAN_MONTHS_CAP) {
    month++
    for (const d of open) {
      const interest = d.balance * (d.apr / 100 / 12)
      d.balance += interest
      totalInterest += interest
    }
    // Minimums first (every open debt gets its own payment), then whatever is
    // left cascades down the strategy's priority order.
    let budget = pool
    for (const d of open) {
      const paid = Math.min(d.payment, d.balance, budget)
      d.balance -= paid
      budget -= paid
    }
    const priority = [...open].sort(strategy === 'snowball'
      ? (a, b) => a.balance - b.balance
      : (a, b) => b.apr - a.apr || a.balance - b.balance)
    for (const d of priority) {
      if (budget <= 0) break
      const paid = Math.min(budget, d.balance)
      d.balance -= paid
      budget -= paid
    }
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i]!.balance <= 0.005) {
        payoffOrder.push({ id: open[i]!.id, month })
        open.splice(i, 1)
      }
    }
    series.push(round2(open.reduce((sum, d) => sum + d.balance, 0)))
  }

  // splice() walks backwards, so same-month payoffs land in reverse — put the
  // order back to "first paid, first listed".
  payoffOrder.sort((a, b) => a.month - b.month)

  return { months: month, paidOff: open.length === 0, totalInterest: round2(totalInterest), series, payoffOrder }
}

export interface GoalWhatIf {
  /** Months until the goal is reached (0 = already there); null = out of reach at this pace */
  months: number | null
  /** Projected saved amount per month, clamped at the target; empty when out of reach */
  series: { date: Date, value: number }[]
}

/** "If I save X per month, when do I hit this goal?" — linear, no interest. */
export function simulateGoalSaving(saved: number, target: number, monthlySaving: number, from: Date = new Date()): GoalWhatIf {
  const start = Math.max(saved, 0)
  if (target > 0 && start >= target) return { months: 0, series: [{ date: from, value: start }] }
  if (monthlySaving <= 0) return { months: null, series: [] }
  const months = Math.ceil((target - start) / monthlySaving)
  if (months > PLAN_MONTHS_CAP) return { months: null, series: [] }
  const series = Array.from({ length: months + 1 }, (_, m) => ({
    date: addMonths(from, m),
    value: Math.min(start + m * monthlySaving, target),
  }))
  return { months, series }
}

export interface GoalScenarioRow {
  date: Date
  /** The monthly amount being tried in the what-if input */
  plan: number
  /** The user's actual recent saving pace (absent when ≤ 0 or ≈ plan) */
  pace?: number
  /** What the goal's target date demands (absent without one, or when ≈ plan) */
  required?: number
}

/**
 * Side-by-side linear projections over the tried amount's horizon: where the
 * actual recent pace and the target date's required pace would each stand by
 * the month the tried amount reaches the goal. The insight is the gap between
 * slopes, so comparison lines that would sit on top of the plan (within
 * 1/month, e.g. the input's default of the rounded pace) are dropped. Faster
 * lines clamp at the target — a plateau, not an overshoot.
 */
export function simulateGoalScenarios(
  saved: number,
  target: number,
  months: number,
  rates: { plan: number, pace?: number | null, required?: number | null },
  from: Date = new Date(),
): GoalScenarioRow[] {
  const start = Math.max(saved, 0)
  const clamp = (v: number) => Math.min(round2(v), target)
  const pace = rates.pace != null && rates.pace > 0 && Math.abs(rates.pace - rates.plan) >= 1 ? rates.pace : null
  const required = rates.required != null && rates.required > 0 && Math.abs(rates.required - rates.plan) >= 1 ? rates.required : null
  return Array.from({ length: months + 1 }, (_, m) => {
    const row: GoalScenarioRow = { date: addMonths(from, m), plan: clamp(start + m * rates.plan) }
    if (pace != null) row.pace = clamp(start + m * pace)
    if (required != null) row.required = clamp(start + m * required)
    return row
  })
}
