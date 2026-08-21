import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { ruleReorderSchema } from '~~/shared/schemas'

// Replace the priority order with the given id list (array index = priority).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const { ids } = await readValidatedBody(event, ruleReorderSchema.parse)

  const rules = await db.query.transactionRules.findMany({
    where: (r, { eq }) => eq(r.userId, userId),
    columns: { id: true },
  })
  const owned = new Set(rules.map(r => r.id))
  // The list must be exactly the user's rule set — no missing, foreign, or duplicate ids.
  if (ids.length !== owned.size || new Set(ids).size !== ids.length || !ids.every(id => owned.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Rule list out of date' })
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(schema.transactionRules)
        .set({ priority: index + 1 })
        .where(eq(schema.transactionRules.id, id))
    }
  })

  return { ok: true }
})
