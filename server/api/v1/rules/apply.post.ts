import { db, schema } from '@nuxthub/db'
import { and, inArray, isNull } from 'drizzle-orm'

// Retroactively run the user's rules over existing uncategorized transactions.
// Transfer legs and fee rows are excluded (intentionally uncategorized / system-set).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const rules = await getActiveRules(userId)
  if (!rules.length) return { updated: 0 }

  const candidates = await db.query.transactions.findMany({
    where: (t, { and, eq, isNull, isNotNull }) => and(
      eq(t.userId, userId),
      isNull(t.categoryId),
      isNull(t.transferId),
      isNull(t.feeOfId),
      isNotNull(t.description),
    ),
    columns: { id: true, description: true, type: true },
  })

  // Bucket matched ids per category → one UPDATE per category.
  const buckets = new Map<string, string[]>()
  for (const tx of candidates) {
    const categoryId = matchCategory(tx.description, tx.type, rules)
    if (!categoryId) continue
    const bucket = buckets.get(categoryId)
    if (bucket) bucket.push(tx.id)
    else buckets.set(categoryId, [tx.id])
  }
  if (!buckets.size) return { updated: 0 }

  let updated = 0
  await db.transaction(async (tx) => {
    for (const [categoryId, ids] of buckets) {
      await tx.update(schema.transactions)
        .set({ categoryId })
        // Re-check categoryId IS NULL so a concurrent categorization isn't clobbered.
        .where(and(inArray(schema.transactions.id, ids), isNull(schema.transactions.categoryId)))
      updated += ids.length
    }
  })

  return { updated }
})
