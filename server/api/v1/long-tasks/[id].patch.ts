import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { longTaskUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, longTaskUpdateSchema.parse)

  assertNotEmpty(body)

  const existing = await db.query.longTasks.findFirst({
    where: (lt, { and, eq }) => and(eq(lt.id, id), eq(lt.userId, userId)),
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Long task not found' })

  const { targetDate, done, ...rest } = body
  const [updated] = await db
    .update(schema.longTasks)
    .set({
      ...rest,
      ...(targetDate !== undefined && { targetDate: targetDate ? toDateStr(targetDate) : null }),
      // completedAt is server-managed: stamped on the false→true transition,
      // cleared on true→false, untouched otherwise.
      ...(done !== undefined && done !== existing.done && {
        done,
        completedAt: done ? new Date() : null,
      }),
    })
    .where(and(eq(schema.longTasks.id, id), eq(schema.longTasks.userId, userId)))
    .returning()

  return updated
})
