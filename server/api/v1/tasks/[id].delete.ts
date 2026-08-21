import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  await deleteOwned(schema.tasks, getRouterParam(event, 'id')!, event.context.userId, 'Task not found')

  return { ok: true }
})
