import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  // Tasks under this category survive — the FK sets their categoryId null.
  await deleteOwned(schema.taskCategories, getRouterParam(event, 'id')!, event.context.userId, 'Task category not found')

  return { ok: true }
})
