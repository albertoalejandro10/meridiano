import { db } from '@nuxthub/db'

// The optional fields from Settings → Financial profile (see
// index.patch.ts). Everything else about the user lives in the session
// (shared/auth.d.ts) — these are DB-only since they're sensitive and would
// otherwise round-trip in the sealed session cookie on every request.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: {
      jobTitle: true,
      income: true,
      incomeCurrency: true,
      employmentType: true,
      maritalStatus: true,
      dependents: true,
      riskTolerance: true,
      financialNotes: true,
    },
  })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  return { ...user, income: user.income == null ? null : Number(user.income) }
})
