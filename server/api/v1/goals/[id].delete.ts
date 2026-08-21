import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  await deleteOwned(schema.goals, getRouterParam(event, 'id')!, event.context.userId, 'Goal not found')

  return { ok: true }
})
