export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/v1')) return

  const { user } = await getUserSession(event)
  if (user?.id) {
    event.context.userId = user.id
    return
  }

  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
