import { db, schema } from '@nuxthub/db'
import type { DefaultCategory } from './defaultCategories'

// Find-or-create one of the seeded categories that server code files rows under
// by itself (fees, reconciliation adjustments). Load-bearing for existing users:
// the seed in categories/index.get.ts only runs when a user has zero categories,
// so anyone older than the feature gets the category lazily here, on first use.
//
// Matched by slug first, falling back to the English name for rows that predate
// migration 0013 (or whose icon drifted, so the backfill skipped them). Ordering
// by slug ASC puts the NULL-slug legacy row last, so a properly slugged category
// always wins when both somehow exist.
export async function ensureCategory(userId: string, category: DefaultCategory): Promise<string> {
  const find = () => db.query.categories.findFirst({
    where: (c, { and, eq, or }) => and(
      eq(c.userId, userId),
      or(eq(c.slug, category.slug), eq(c.name, category.name)),
    ),
    orderBy: (c, { asc }) => [asc(c.slug)],
    columns: { id: true },
  })

  const existing = await find()
  if (existing) return existing.id

  const [created] = await db
    .insert(schema.categories)
    .values({ ...category, userId })
    .onConflictDoNothing()
    .returning({ id: schema.categories.id })
  if (created) return created.id

  // A concurrent request won the insert race — the row exists now.
  const row = await find()
  return row!.id
}

/** Where fee rows land. */
export const ensureFeesCategory = (userId: string) => ensureCategory(userId, feesCategory)

/** Where reconciliation adjustments land. */
export const ensureAdjustmentCategory = (userId: string) => ensureCategory(userId, adjustmentCategory)

// Top up the user's categories with any default they're missing, and report how
// many were actually added. Idempotent by construction: the conflict clause is
// deliberately *untargeted* so it covers both unique keys — the slug key (the
// default is already there, even if the user renamed it) and the name key (the
// user hand-made a category sharing a default's English name, which keeps its
// own NULL slug and prose). Postgres only RETURNs genuinely inserted rows on
// ON CONFLICT DO NOTHING, so the count is exact and concurrent calls are safe.
export async function restoreDefaultCategories(userId: string): Promise<number> {
  const inserted = await db
    .insert(schema.categories)
    .values(defaultCategories.map(c => ({ ...c, userId })))
    .onConflictDoNothing()
    .returning({ id: schema.categories.id })
  return inserted.length
}
