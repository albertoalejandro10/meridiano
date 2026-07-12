import { db } from '@nuxthub/db'
import { loginSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, loginSchema.parse)

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  })
  if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, { user: { id: user.id, email: user.email, name: user.name } })
  return { user: { id: user.id, email: user.email, name: user.name } }
})
