import { db } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const existing = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => asc(c.name),
  })
  if (existing.length > 0) return existing

  // Fallback seed: new users are seeded at register, but this keeps the picker
  // populated for any account that somehow has none yet.
  await restoreDefaultCategories(userId)

  return db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => asc(c.name),
  })
})
