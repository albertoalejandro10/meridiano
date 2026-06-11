export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!

  const account = await prisma.account.findFirst({ where: { id, userId } })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  const txCount = await prisma.transaction.count({ where: { accountId: id } })
  if (txCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Account has transactions. Archive it instead.',
    })
  }

  await prisma.account.delete({ where: { id } })
  return { ok: true }
})
