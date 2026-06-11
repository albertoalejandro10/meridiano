import { transactionQuerySchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const q = await getValidatedQuery(event, transactionQuerySchema.parse)

  const items = await prisma.transaction.findMany({
    where: {
      userId,
      ...(q.accountId && { accountId: q.accountId }),
      ...(q.type && { type: q.type }),
      ...((q.from || q.to) && { date: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
    },
    include: { account: true, category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: q.limit + 1,
    ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
  })

  const hasMore = items.length > q.limit
  if (hasMore) items.pop()

  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null }
})
