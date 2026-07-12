import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const existing = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => asc(c.name),
  })
  if (existing.length > 0) return existing

  // Fallback seed: new users are seeded at register, but this keeps the picker
  // populated for any account that somehow has none yet.
  await db
    .insert(schema.categories)
    .values(defaultCategories.map(c => ({ ...c, userId })))
    .onConflictDoNothing()

  return db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => asc(c.name),
  })
})
