import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const note = await db.query.notes.findFirst({
    where: (n, { and, eq }) => and(eq(n.id, id), eq(n.userId, userId)),
  })
  if (!note) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

  return note
})
