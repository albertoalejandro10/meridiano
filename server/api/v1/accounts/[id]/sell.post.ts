import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { sellAssetSchema } from '~~/shared/schemas'

// Only fixed-value possessions (vehicles, other assets) are "sold" to realize their worth into cash.
const SELLABLE_TYPES = ['VEHICLE', 'OTHER_ASSET']

// Sell an asset: the proceeds move into a cash account (as a transfer, so they
// stay out of goal savings) and the asset is archived. The realized gain/loss
// is reflected purely as the net-worth change (proceeds - carrying value).
export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const assetId = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, sellAssetSchema.parse)

  if (assetId === body.toAccountId) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a different destination account' })
  }

  const [asset, destination] = await Promise.all([
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, assetId), eq(a.userId, userId)) }),
    db.query.accounts.findFirst({ where: (a, { and, eq }) => and(eq(a.id, body.toAccountId), eq(a.userId, userId)) }),
  ])
  if (!asset || !destination) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  if (!SELLABLE_TYPES.includes(asset.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Only vehicles and other assets can be sold' })
  }
  if (asset.archived || destination.archived) {
    throw createError({ statusCode: 400, statusMessage: 'Archived accounts cannot take part in a sale' })
  }
  // Same rule as transfers: the two legs share one amount, so no FX yet.
  if (destination.currency !== asset.currency) {
    throw createError({ statusCode: 400, statusMessage: 'Proceeds must go to an account in the same currency' })
  }

  const transferId = crypto.randomUUID()
  const incomeId = crypto.randomUUID()
  const date = toDateStr(body.date)
  const amount = toAmount(body.amount)
  const description = body.description ?? `Sold ${asset.name}`

  const rows: (typeof schema.transactions.$inferInsert)[] = [
    { userId, accountId: asset.id, transferId, type: 'EXPENSE', amount, currency: asset.currency, date, description },
    { id: incomeId, userId, accountId: destination.id, transferId, type: 'INCOME', amount, currency: destination.currency, date, description },
  ]
  // Sale commission, deducted from the proceeds: an EXPENSE on the destination
  // linked to the INCOME leg (same model as transfer fees).
  if (body.fee) {
    rows.push({
      userId,
      accountId: destination.id,
      categoryId: await ensureFeesCategory(userId),
      type: 'EXPENSE',
      amount: toAmount(body.fee),
      currency: destination.currency,
      date,
      description: 'Sale fee',
      feeOfId: incomeId,
    })
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.transactions).values(rows)
    await tx
      .update(schema.accounts)
      .set({ archived: true })
      .where(and(eq(schema.accounts.id, asset.id), eq(schema.accounts.userId, userId)))
  })

  return { ok: true, transferId }
})
