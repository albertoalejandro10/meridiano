import { transactionUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, transactionUpdateSchema.parse)

  let currency
  if (body.accountId) {
    const account = await prisma.account.findFirst({ where: { id: body.accountId, userId } })
    if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    currency = account.currency
  }

  const { count } = await prisma.transaction.updateMany({
    where: { id, userId },
    data: { ...body, ...(currency && { currency }) },
  })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  return prisma.transaction.findUnique({
    where: { id },
    include: { account: true, category: true },
  })
})
