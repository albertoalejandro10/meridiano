import { db, schema } from '@nuxthub/db'
import { goalSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, goalSchema.parse)

  const { targetAmount, startDate, targetDate, accountIds, ...rest } = body

  const goal = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.goals)
      .values({
        ...rest,
        targetAmount: toAmount(targetAmount),
        startDate: toDateStr(startDate),
        ...(targetDate != null && { targetDate: toDateStr(targetDate) }),
        userId,
      })
      .returning()
    await replaceGoalAccounts(tx, userId, created!.id, accountIds, created!.currency)
    return created
  })

  return goal
})
