import { db, schema } from '@nuxthub/db'
import { taskSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, taskSchema.parse)

  if (body.longTaskId) await assertLongTaskOwnership(userId, body.longTaskId)

  const [task] = await db
    .insert(schema.tasks)
    .values({
      ...body,
      userId,
      dueDate: body.dueDate ? toDateStr(body.dueDate) : null,
      completedAt: body.done ? new Date() : null,
    })
    .returning()
  return task
})
