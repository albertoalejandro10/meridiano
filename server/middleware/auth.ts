import { serverSupabaseUser } from '#supabase/server'

const ensuredUsers = new Set<string>()

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/v1')) return

  const user = await serverSupabaseUser(event).catch(() => null)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Fallback for sessions created before the auth.users trigger existed
  if (!ensuredUsers.has(user.id)) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    })
    ensuredUsers.add(user.id)
  }

  event.context.userId = user.id
})
