import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { noteUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, noteUpdateSchema.parse)

  assertNotEmpty(body)

  const [updated] = await db
    .update(schema.notes)
    .set(body)
    .where(and(eq(schema.notes.id, id), eq(schema.notes.userId, userId)))
    .returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  return updated
})
