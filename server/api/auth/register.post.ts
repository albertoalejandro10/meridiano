import { db, schema } from '@nuxthub/db'
import { registerSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const { name, email, password } = await readValidatedBody(event, registerSchema.parse)

  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, email),
    columns: { id: true },
  })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Email already registered' })

  const passwordHash = await hashPassword(password)
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({ email, name: name ?? null, passwordHash })
      .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name })

    await tx
      .insert(schema.categories)
      .values(defaultCategories.map(c => ({ ...c, userId: created!.id })))

    return created!
  }).catch((e: unknown) => {
    // Concurrent registers can pass the findFirst check and race on the unique
    // email index — surface that as the same 409 instead of a raw 500.
    const code = (e as { code?: string, cause?: { code?: string } }).code
      ?? (e as { cause?: { code?: string } }).cause?.code
    if (code === '23505') throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
    throw e
  })

  await setUserSession(event, { user: { id: user.id, email: user.email, name: user.name } })
  return { user }
})
