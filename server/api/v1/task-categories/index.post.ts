import { db, schema } from '@nuxthub/db'
import { taskCategorySchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, taskCategorySchema.parse)

  try {
    const [category] = await db
      .insert(schema.taskCategories)
      .values({ ...body, userId })
      .returning()
    return category
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'Category name already in use' })
    }
    throw err
  }
})
