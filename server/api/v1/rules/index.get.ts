import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  return db.query.transactionRules.findMany({
    where: (r, { eq }) => eq(r.userId, userId),
    orderBy: (r, { asc }) => [asc(r.priority)],
    with: { category: true },
  })
})
