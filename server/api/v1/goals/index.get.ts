import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const [goals, accounts, netByCurrency] = await Promise.all([
    db.query.goals.findMany({
      where: (g, { eq }) => eq(g.userId, userId),
      orderBy: (g, { asc }) => asc(g.createdAt),
      with: { links: true },
    }),
    accountsWithBalance(userId),
    recentMonthlyNetByCurrency(userId),
  ])

  const balanceByAccount = new Map(accounts.map(a => [a.id, a]))
  return goals.map(goal => enrichGoal(goal, balanceByAccount, netByCurrency))
})
