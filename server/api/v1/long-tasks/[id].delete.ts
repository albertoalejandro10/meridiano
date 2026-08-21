import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  // Linked monthly tasks are real history — the FK just unlinks them (set null).
  await deleteOwned(schema.longTasks, getRouterParam(event, 'id')!, event.context.userId, 'Long task not found')

  return { ok: true }
})
