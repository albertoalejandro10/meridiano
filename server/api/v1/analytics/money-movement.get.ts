import { analyticsRangeQuerySchema } from '~~/shared/schemas'

// What moving money between own accounts costs: the rate each cross-currency
// transfer realised, the fees each route charged, and what share of income
// those fees ate. All derived from the existing transfer pairs and fee rows —
// see computeConversions/computeFeeBreakdown/computeFeeDrag
// (server/utils/moneyMovement.ts) for the queries.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, analyticsRangeQuerySchema.parse)

  const [conversions, fees, drag] = await Promise.all([
    computeConversions(userId, q.months),
    computeFeeBreakdown(userId, q.months),
    computeFeeDrag(userId, q.months),
  ])

  return { conversions, fees, drag }
})
