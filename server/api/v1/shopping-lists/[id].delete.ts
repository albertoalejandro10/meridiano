import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  // Items go with the list via the FK cascade.
  await deleteOwned(schema.shoppingLists, getRouterParam(event, 'id')!, event.context.userId, 'Shopping list not found')

  return { ok: true }
})
