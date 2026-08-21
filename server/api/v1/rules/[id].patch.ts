import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { transactionRuleUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, transactionRuleUpdateSchema.parse)

  const existing = await db.query.transactionRules.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, id), eq(r.userId, userId)),
    columns: { id: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Rule not found' })

  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  await db.update(schema.transactionRules).set(body).where(eq(schema.transactionRules.id, id))

  return db.query.transactionRules.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: { category: true },
  })
})
