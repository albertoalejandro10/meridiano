import { db, schema } from '@nuxthub/db'
import { accountSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, accountSchema.parse)

  const [account] = await db
    .insert(schema.accounts)
    .values({ ...body, initialBalance: toAmount(body.initialBalance), userId })
    .returning()
  return account
})
