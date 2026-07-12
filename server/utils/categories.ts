import { db, schema } from '@nuxthub/db'

// Find-or-create the user's "Fees" category (fee rows are filed under it).
// Load-bearing for existing users: the seed in categories/index.get.ts only
// runs when a user has zero categories, so anyone older than this feature
// gets the category lazily here, on their first fee. If the user already owns
// a "Fees" category (any type/icon), it is reused as-is.
export async function ensureFeesCategory(userId: string): Promise<string> {
  const existing = await db.query.categories.findFirst({
    where: (c, { and, eq }) => and(eq(c.userId, userId), eq(c.name, feesCategory.name)),
    columns: { id: true },
  })
  if (existing) return existing.id

  const [created] = await db
    .insert(schema.categories)
    .values({ ...feesCategory, userId })
    .onConflictDoNothing()
    .returning({ id: schema.categories.id })
  if (created) return created.id

  // A concurrent request won the insert race — the row exists now.
  const row = await db.query.categories.findFirst({
    where: (c, { and, eq }) => and(eq(c.userId, userId), eq(c.name, feesCategory.name)),
    columns: { id: true },
  })
  return row!.id
}
