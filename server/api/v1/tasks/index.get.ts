import { db } from '@nuxthub/db'
import { taskQuerySchema } from '~~/shared/schemas'

// One month of tasks plus every still-pending task from earlier months — the
// latter powers both the carry-over banner (count) and its modal (checklist)
// in a single round-trip. Final grouping/sorting is client-side.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, taskQuerySchema.parse)

  const month = q.month ?? lastMonths(1)[0]!

  const [tasks, previousPending] = await Promise.all([
    db.query.tasks.findMany({
      where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.month, month)),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    }),
    // 'yyyy-MM' strings sort lexicographically = chronologically.
    db.query.tasks.findMany({
      where: (t, { and, eq, lt }) => and(eq(t.userId, userId), eq(t.done, false), lt(t.month, month)),
      orderBy: (t, { asc }) => [asc(t.month), asc(t.createdAt)],
      columns: { id: true, title: true, month: true, priority: true, categoryId: true },
    }),
  ])

  return { month, tasks, previousPending }
})
