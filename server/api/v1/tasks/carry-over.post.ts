import { db, schema } from '@nuxthub/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { taskCarryOverSchema } from '~~/shared/schemas'

// Move selected unfinished tasks into toMonth. The old due day can't exist in
// the new month, so dueDate is cleared; carriedFromMonth keeps the origin for
// the "from {month}" badge (SET reads pre-update values, so this is atomic).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, taskCarryOverSchema.parse)

  const moved = await db
    .update(schema.tasks)
    .set({
      month: body.toMonth,
      dueDate: null,
      carriedFromMonth: sql`${schema.tasks.month}`,
    })
    .where(and(
      eq(schema.tasks.userId, userId),
      inArray(schema.tasks.id, body.ids),
      eq(schema.tasks.done, false),
    ))
    .returning()

  return moved
})
