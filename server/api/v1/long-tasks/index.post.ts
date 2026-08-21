import { db, schema } from '@nuxthub/db'
import { longTaskSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, longTaskSchema.parse)

  const [longTask] = await db
    .insert(schema.longTasks)
    .values({
      ...body,
      userId,
      targetDate: body.targetDate ? toDateStr(body.targetDate) : null,
      completedAt: body.done ? new Date() : null,
    })
    .returning()
  return longTask
})
