import { accountSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, accountSchema.parse)

  return prisma.account.create({ data: { ...body, userId } })
})
