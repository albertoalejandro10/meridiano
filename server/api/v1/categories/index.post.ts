import { db, schema } from '@nuxthub/db'
import { categorySchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, categorySchema.parse)

  const [category] = await db
    .insert(schema.categories)
    .values({ ...body, userId })
    .returning()
  return category
})
