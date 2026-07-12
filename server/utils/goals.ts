import { db, schema } from '@nuxthub/db'
import { and, eq, gte, isNull, sum } from 'drizzle-orm'
import { subMonths } from 'date-fns'
import { isLiabilityType } from '~~/shared/schemas'
import type { AccountWithBalance } from './balances'

// A Drizzle transaction handle (same query API as `db`).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type GoalRow = typeof schema.goals.$inferSelect
type GoalWithLinks = GoalRow & { links: { accountId: string }[] }

/**
 * The user's trailing average *monthly* net savings (INCOME − EXPENSE, transfers
 * excluded) per currency, over the last `months`. This is the "economic reality"
 * baseline the UI compares against the amount a goal still needs each month.
 */
export async function recentMonthlyNetByCurrency(userId: string, months = 6): Promise<Map<string, number>> {
  const since = toDateStr(subMonths(new Date(), months))
  const t = schema.transactions
  const rows = await db
    .select({ currency: t.currency, type: t.type, total: sum(t.amount) })
    .from(t)
    .where(and(eq(t.userId, userId), gte(t.date, since), isNull(t.transferId)))
    .groupBy(t.currency, t.type)

  const net = new Map<string, number>()
  for (const r of rows) {
    const amount = Number(r.total ?? 0)
    net.set(r.currency, (net.get(r.currency) ?? 0) + (r.type === 'INCOME' ? amount : -amount))
  }
  for (const [currency, total] of net) net.set(currency, total / months)
  return net
}

/**
 * Replace a goal's linked asset accounts. Every account must belong to the user,
 * be an asset (not a liability), and match the goal's currency (no FX in the app).
 * Runs inside the caller's transaction so the goal + its links commit atomically.
 */
export async function replaceGoalAccounts(
  tx: Tx,
  userId: string,
  goalId: string,
  accountIds: string[],
  goalCurrency: string,
): Promise<void> {
  await tx.delete(schema.goalAccounts).where(eq(schema.goalAccounts.goalId, goalId))
  if (accountIds.length === 0) return

  const unique = [...new Set(accountIds)]
  const accounts = await tx.query.accounts.findMany({
    where: (a, { and, eq, inArray }) => and(eq(a.userId, userId), inArray(a.id, unique)),
  })
  if (accounts.length !== unique.length) {
    throw createError({ statusCode: 400, statusMessage: 'Some linked accounts were not found' })
  }
  for (const a of accounts) {
    if (isLiabilityType(a.type)) {
      throw createError({ statusCode: 400, statusMessage: 'Only asset accounts can back a goal' })
    }
    if (a.currency !== goalCurrency) {
      throw createError({ statusCode: 400, statusMessage: "Linked assets must match the goal's currency" })
    }
  }
  await tx.insert(schema.goalAccounts).values(unique.map(accountId => ({ goalId, accountId })))
}

/**
 * Shape a goal row (with its `links`) into the API response: derived `saved`
 * (sum of the linked accounts' balances), the linked accounts, and the recent
 * monthly savings pace for the goal's currency.
 */
export function enrichGoal(
  goal: GoalWithLinks,
  balanceByAccount: Map<string, AccountWithBalance>,
  netByCurrency: Map<string, number>,
) {
  const { links, ...rest } = goal
  const linkedAccounts = links
    .map(l => balanceByAccount.get(l.accountId))
    .filter((a): a is AccountWithBalance => Boolean(a))
    .map(a => ({ id: a.id, name: a.name, type: a.type, currency: a.currency, balance: a.balance }))

  const saved = linkedAccounts.reduce((total, a) => total + a.balance, 0)
  return {
    ...rest,
    saved,
    linkedAccounts,
    recentMonthlyNet: netByCurrency.get(goal.currency) ?? 0,
  }
}
