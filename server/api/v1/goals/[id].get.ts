import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const goal = await db.query.goals.findFirst({
    where: (g, { and, eq }) => and(eq(g.id, id), eq(g.userId, userId)),
    with: { links: true },
  })
  if (!goal) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })

  const [accounts, netByCurrency] = await Promise.all([
    accountsWithBalance(userId),
    recentMonthlyNetByCurrency(userId),
  ])
  const balanceByAccount = new Map(accounts.map(a => [a.id, a]))
  return enrichGoal(goal, balanceByAccount, netByCurrency)
})
