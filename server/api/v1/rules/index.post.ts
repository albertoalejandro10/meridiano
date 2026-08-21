import { db, schema } from '@nuxthub/db'
import { eq, max } from 'drizzle-orm'
import { transactionRuleSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, transactionRuleSchema.parse)

  await requireOwnCategory(userId, body.categoryId)

  // Server-assigned priority (max + 1 per user) so new rules match last.
  const [row] = await db
    .select({ maxPriority: max(schema.transactionRules.priority) })
    .from(schema.transactionRules)
    .where(eq(schema.transactionRules.userId, userId))

  const [rule] = await db
    .insert(schema.transactionRules)
    .values({ ...body, userId, priority: (row!.maxPriority ?? 0) + 1 })
    .returning()

  return db.query.transactionRules.findFirst({
    where: (r, { eq }) => eq(r.id, rule!.id),
    with: { category: true },
  })
})
