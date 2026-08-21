import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  await deleteOwned(schema.notes, getRouterParam(event, 'id')!, event.context.userId, 'Note not found')

  return { ok: true }
})
