import { analyticsRangeQuerySchema } from '~~/shared/schemas'

// Monthly income vs expenses (and the savings rate they imply) per currency,
// over the trailing `months` window. See computeCashflow (server/utils/analytics.ts)
// for the query itself — also reused by the AI digest context.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, analyticsRangeQuerySchema.parse)

  return { rows: await computeCashflow(userId, q.months) }
})
