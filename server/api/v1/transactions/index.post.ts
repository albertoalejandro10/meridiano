import { transactionSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, transactionSchema.parse)

  const account = await prisma.account.findFirst({
    where: { id: body.accountId, userId },
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  return prisma.transaction.create({
    data: { ...body, currency: account.currency, userId },
    include: { account: true, category: true },
  })
})
