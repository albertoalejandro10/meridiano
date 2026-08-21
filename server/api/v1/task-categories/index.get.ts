import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  return db.query.taskCategories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => [asc(c.name)],
  })
})
