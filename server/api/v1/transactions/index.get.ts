import { db, schema } from '@nuxthub/db'
import { and, eq, gte, isNull, lt, lte, or } from 'drizzle-orm'
import { transactionQuerySchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const q = await getValidatedQuery(event, transactionQuerySchema.parse)

  const t = schema.transactions
  const conditions = [eq(t.userId, userId)]
  if (q.accountId) conditions.push(eq(t.accountId, q.accountId))
  if (q.categoryId === 'none') conditions.push(isNull(t.categoryId))
  else if (q.categoryId) conditions.push(eq(t.categoryId, q.categoryId))
  if (q.type) conditions.push(eq(t.type, q.type))
  if (q.from) conditions.push(gte(t.date, toDateStr(q.from)))
  if (q.to) conditions.push(lte(t.date, toDateStr(q.to)))

  // Keyset pagination: continue strictly after the cursor row, following the
  // (date desc, createdAt desc, id desc) ordering. The id tiebreaker matters:
  // rows inserted in one statement (e.g. the two legs of a transfer) share the
  // same date AND createdAt, and would otherwise be skipped at a page boundary.
  if (q.cursor) {
    const cursorRow = await db.query.transactions.findFirst({
      where: (tx, { and, eq }) => and(eq(tx.id, q.cursor!), eq(tx.userId, userId)),
      columns: { id: true, date: true, createdAt: true },
    })
    if (cursorRow) {
      conditions.push(
        or(
          lt(t.date, cursorRow.date),
          and(eq(t.date, cursorRow.date), lt(t.createdAt, cursorRow.createdAt)),
          and(eq(t.date, cursorRow.date), eq(t.createdAt, cursorRow.createdAt), lt(t.id, cursorRow.id)),
        )!,
      )
    }
  }

  const items = await db.query.transactions.findMany({
    where: and(...conditions),
    with: { account: true, category: true },
    orderBy: (tx, { desc }) => [desc(tx.date), desc(tx.createdAt), desc(tx.id)],
    limit: q.limit + 1,
  })

  const hasMore = items.length > q.limit
  if (hasMore) items.pop()

  // For transfer rows, attach the counterpart leg's account name plus its
  // amount and currency (they differ on cross-currency transfers).
  const transferIds = [...new Set(items.filter(i => i.transferId).map(i => i.transferId!))]
  const siblings = transferIds.length
    ? await db.query.transactions.findMany({
        where: (tx, { and, eq, inArray }) => and(eq(tx.userId, userId), inArray(tx.transferId, transferIds)),
        columns: { transferId: true, accountId: true, amount: true, currency: true },
        with: { account: { columns: { name: true } } },
      })
    : []

  // Attach each row's linked fee amounts (fee rows point at their parent via
  // feeOfId), so the edit modal can prefill them. Lookup is by id, so it works
  // even when the fee rows land on another page.
  const itemIds = items.map(i => i.id)
  const feeRows = itemIds.length
    ? await db.query.transactions.findMany({
        where: (tx, { and, eq, inArray }) => and(eq(tx.userId, userId), inArray(tx.feeOfId, itemIds)),
        columns: { feeOfId: true, feeKind: true, amount: true },
      })
    : []

  const enriched = items.map((item) => {
    const internalFee = feeRows.find(f => f.feeOfId === item.id && f.feeKind === 'INTERNAL')?.amount ?? null
    const externalFee = feeRows.find(f => f.feeOfId === item.id && f.feeKind === 'EXTERNAL')?.amount ?? null
    if (!item.transferId) return { ...item, transferAccount: null, transferAmount: null, transferCurrency: null, internalFee, externalFee }
    const other = siblings.find(s => s.transferId === item.transferId && s.accountId !== item.accountId)
    return {
      ...item,
      transferAccount: other?.account?.name ?? null,
      transferAmount: other?.amount ?? null,
      transferCurrency: other?.currency ?? null,
      internalFee,
      externalFee,
    }
  })

  return { items: enriched, nextCursor: hasMore ? enriched[enriched.length - 1]!.id : null }
})
