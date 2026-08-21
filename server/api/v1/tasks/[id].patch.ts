import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { taskUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, taskUpdateSchema.parse)

  assertNotEmpty(body)

  const existing = await db.query.tasks.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  if (body.longTaskId) await assertLongTaskOwnership(userId, body.longTaskId)

  // The create schema's month/dueDate refine can't run on a partial body —
  // check the coherence of the merged row instead.
  const { dueDate, done, ...rest } = body
  const mergedMonth = rest.month ?? existing.month
  const mergedDueDate = dueDate === undefined ? existing.dueDate : (dueDate ? toDateStr(dueDate) : null)
  if (mergedDueDate && !mergedDueDate.startsWith(mergedMonth)) {
    throw createError({ statusCode: 422, statusMessage: 'Due date must fall within the task month' })
  }

  const [updated] = await db
    .update(schema.tasks)
    .set({
      ...rest,
      ...(dueDate !== undefined && { dueDate: mergedDueDate }),
      // completedAt is server-managed: stamped on the false→true transition,
      // cleared on true→false, untouched otherwise.
      ...(done !== undefined && done !== existing.done && {
        done,
        completedAt: done ? new Date() : null,
      }),
    })
    .where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, userId)))
    .returning()

  return updated
})
