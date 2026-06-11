import { categorySchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readValidatedBody(event, categorySchema.parse)

  return prisma.category.create({ data: { ...body, userId } })
})
