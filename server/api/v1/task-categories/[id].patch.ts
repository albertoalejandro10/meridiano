import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { taskCategoryUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, taskCategoryUpdateSchema.parse)

  assertNotEmpty(body)

  try {
    const [updated] = await db
      .update(schema.taskCategories)
      .set(body)
      .where(and(eq(schema.taskCategories.id, id), eq(schema.taskCategories.userId, userId)))
      .returning()
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Task category not found' })

    return updated
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'Category name already in use' })
    }
    throw err
  }
})
