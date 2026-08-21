import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { userProfileSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, userProfileSchema.parse)

  const [user] = await db
    .update(schema.users)
    .set({
      jobTitle: body.jobTitle,
      income: body.income == null ? null : toAmount(body.income),
      incomeCurrency: body.incomeCurrency,
      employmentType: body.employmentType,
      maritalStatus: body.maritalStatus,
      dependents: body.dependents,
      riskTolerance: body.riskTolerance,
      financialNotes: body.financialNotes,
    })
    .where(eq(schema.users.id, userId))
    .returning({
      jobTitle: schema.users.jobTitle,
      income: schema.users.income,
      incomeCurrency: schema.users.incomeCurrency,
      employmentType: schema.users.employmentType,
      maritalStatus: schema.users.maritalStatus,
      dependents: schema.users.dependents,
      riskTolerance: schema.users.riskTolerance,
      financialNotes: schema.users.financialNotes,
    })

  return { ...user, income: user!.income == null ? null : Number(user!.income) }
})
