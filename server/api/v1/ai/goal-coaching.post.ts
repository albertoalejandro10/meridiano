import { aiGoalCoachingSchema } from '~~/shared/schemas'

// Narrates a goal "what if" scenario the client already computed (see
// app/utils/planning.ts). The tried monthly amount is a planner input with no
// server counterpart; the rest (saved/target/pace) mirrors what the goals
// endpoint already derives for this same goal.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, aiGoalCoachingSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI coaching is not configured yet.' })
  }

  await assertUnderDailyAiLimit(userId)

  let coaching: string
  try {
    coaching = await generateGoalCoaching(config.opencodeApiKey, {
      goalName: body.goalName,
      currency: body.currency,
      targetAmount: body.targetAmount,
      saved: body.saved,
      targetDate: body.targetDate ? toDateStr(body.targetDate) : null,
      monthlyTried: body.monthlyTried,
      recentMonthlyNet: body.recentMonthlyNet,
      projectedMonths: body.projectedMonths ?? null,
      requiredPerMonth: body.requiredPerMonth ?? null,
    }, body.locale)
  }
  catch (err) {
    console.error('[ai] goal coaching generation failed', err)
    throw createError({ statusCode: 502, statusMessage: 'Could not generate coaching right now. Try again shortly.' })
  }

  await recordAiGeneration(userId, 'goal_coaching')

  return { coaching }
})
