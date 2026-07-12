import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { goalUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, goalUpdateSchema.parse)

  const { targetAmount, startDate, targetDate, accountIds, ...rest } = body
  const data = {
    ...rest,
    ...(targetAmount !== undefined && { targetAmount: toAmount(targetAmount) }),
    ...(startDate !== undefined && { startDate: toDateStr(startDate) }),
    ...(targetDate !== undefined && { targetDate: targetDate === null ? null : toDateStr(targetDate) }),
  }
  if (Object.keys(data).length === 0 && accountIds === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const goal = await db.transaction(async (tx) => {
    let current: typeof schema.goals.$inferSelect | undefined
    if (Object.keys(data).length > 0) {
      const [updated] = await tx
        .update(schema.goals)
        .set(data)
        .where(and(eq(schema.goals.id, id), eq(schema.goals.userId, userId)))
        .returning()
      current = updated
    }
    else {
      current = await tx.query.goals.findFirst({
        where: (g, { and, eq }) => and(eq(g.id, id), eq(g.userId, userId)),
      })
    }
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })

    if (accountIds !== undefined) {
      await replaceGoalAccounts(tx, userId, current.id, accountIds, current.currency)
    }
    return current
  })

  return goal
})
