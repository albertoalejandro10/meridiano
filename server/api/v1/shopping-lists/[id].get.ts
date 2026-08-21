import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!

  const list = await db.query.shoppingLists.findFirst({
    where: (l, { and, eq }) => and(eq(l.id, id), eq(l.userId, userId)),
    with: {
      items: { orderBy: (i, { asc }) => [asc(i.position)] },
    },
  })
  if (!list) throw createError({ statusCode: 404, statusMessage: 'Shopping list not found' })

  return list
})
