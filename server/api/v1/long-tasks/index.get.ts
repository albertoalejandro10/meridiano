import { db, schema } from '@nuxthub/db'
import { and, count, eq, isNotNull, sql } from 'drizzle-orm'

// All the user's long tasks, each with how many monthly next actions link to
// it and how many of those are done — the derived progress shown in the UI.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const t = schema.tasks

  const [longTasks, linkCounts] = await Promise.all([
    db.query.longTasks.findMany({
      where: (lt, { eq }) => eq(lt.userId, userId),
      orderBy: (lt, { asc }) => [asc(lt.createdAt)],
    }),
    db
      .select({
        longTaskId: t.longTaskId,
        total: count(),
        done: sql<number>`count(*) filter (where ${t.done})`,
      })
      .from(t)
      .where(and(eq(t.userId, userId), isNotNull(t.longTaskId)))
      .groupBy(t.longTaskId),
  ])

  const counts = new Map(linkCounts.map(c => [c.longTaskId, c]))
  return longTasks.map((longTask) => {
    const c = counts.get(longTask.id)
    return {
      ...longTask,
      linkedCount: c ? Number(c.total) : 0,
      linkedDoneCount: c ? Number(c.done) : 0,
    }
  })
})
