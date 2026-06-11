import { accountUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, accountUpdateSchema.parse)

  const { count } = await prisma.account.updateMany({
    where: { id, userId },
    data: body,
  })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

  return prisma.account.findUnique({ where: { id } })
})
