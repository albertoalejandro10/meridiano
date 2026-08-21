import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  await deleteOwned(schema.budgets, getRouterParam(event, 'id')!, event.context.userId, 'Budget not found')

  return { ok: true }
})
