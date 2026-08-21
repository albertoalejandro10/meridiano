import { db } from '@nuxthub/db'

// Budgets + expected incomes only — per-month spent is derived client-side from
// the existing /analytics/spending aggregation (same "spent" the analytics page
// shows), so the two never disagree.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const [budgets, incomes] = await Promise.all([
    db.query.budgets.findMany({
      where: (b, { eq }) => eq(b.userId, userId),
      with: { category: true },
      orderBy: (b, { asc }) => [asc(b.createdAt)],
    }),
    db.query.budgetIncomes.findMany({
      where: (i, { eq }) => eq(i.userId, userId),
    }),
  ])

  return { budgets, incomes }
})
