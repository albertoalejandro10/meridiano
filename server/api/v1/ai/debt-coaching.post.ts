import { aiDebtCoachingSchema } from '~~/shared/schemas'

// Narrates a debt-payoff plan the client already computed (see
// app/utils/planning.ts) — APR/payment terms are planner inputs that only
// ever live in localStorage, so there's nothing for the server to
// independently re-derive here beyond validating shape/bounds.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const body = await readValidatedBody(event, aiDebtCoachingSchema.parse)

  const config = useRuntimeConfig(event)
  if (!config.opencodeApiKey) {
    throw createError({ statusCode: 503, statusMessage: 'AI coaching is not configured yet.' })
  }

  await assertUnderDailyAiLimit(userId)

  let coaching: string
  try {
    coaching = await generateDebtCoaching(config.opencodeApiKey, {
      currency: body.currency,
      extraPerMonth: body.extraPerMonth,
      chosenStrategy: body.chosenStrategy,
      snowballPlan: body.snowballPlan,
      avalanchePlan: body.avalanchePlan,
      debts: body.debts,
    }, body.locale)
  }
  catch (err) {
    console.error('[ai] debt coaching generation failed', err)
    throw createError({ statusCode: 502, statusMessage: 'Could not generate coaching right now. Try again shortly.' })
  }

  await recordAiGeneration(userId, 'debt_coaching')

  return { coaching }
})
