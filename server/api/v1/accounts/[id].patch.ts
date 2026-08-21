import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { accountUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, accountUpdateSchema.parse)

  const { initialBalance, ...rest } = body
  const data = {
    ...rest,
    ...(initialBalance !== undefined && { initialBalance: toAmount(initialBalance) }),
  }
  assertNotEmpty(data)

  const [account] = await db
    .update(schema.accounts)
    .set(data)
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)))
    .returning()
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  return account
})
