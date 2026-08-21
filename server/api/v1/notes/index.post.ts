import { db, schema } from '@nuxthub/db'
import { noteSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, noteSchema.parse)

  const [note] = await db
    .insert(schema.notes)
    .values({ ...body, userId })
    .returning()
  return note
})
