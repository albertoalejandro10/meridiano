export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!

  const { count } = await prisma.transaction.deleteMany({ where: { id, userId } })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })

  return { ok: true }
})
