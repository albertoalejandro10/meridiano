import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { transactionUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(event, transactionUpdateSchema.parse)

  // Transfer legs are a linked pair — editing one side would desync the other,
  // so transfers can only be deleted and recreated (matching the UI).
  const existing = await db.query.transactions.findFirst({
    where: (tx, { and, eq }) => and(eq(tx.id, id), eq(tx.userId, userId)),
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
  if (existing.transferId) {
    throw createError({ statusCode: 400, statusMessage: 'Transfers cannot be edited. Delete it and create a new one.' })
  }
  // Fee rows stay editable as ordinary expenses, but can't nest a fee of their own.
  if (existing.feeOfId && (body.internalFee !== undefined || body.externalFee !== undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'A fee cannot have its own fee' })
  }

  if (body.categoryId) await requireOwnCategory(userId, body.categoryId)

  let currency
  if (body.accountId) {
    const account = await db.query.accounts.findFirst({
      where: (a, { and, eq }) => and(eq(a.id, body.accountId!), eq(a.userId, userId)),
    })
    if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    currency = account.currency
  }

  // The fees are not columns — they drive the linked fee rows below.
  const { amount, date, internalFee, externalFee, ...rest } = body
  const data = {
    ...rest,
    ...(amount !== undefined && { amount: toAmount(amount) }),
    ...(date !== undefined && { date: toDateStr(date) }),
    ...(currency && { currency }),
  }
  assertNotEmpty(data, internalFee, externalFee)

  const feeRows = existing.feeOfId
    ? []
    : await db.query.transactions.findMany({
        where: (tx, { eq }) => eq(tx.feeOfId, id),
        columns: { id: true, feeKind: true },
      })
  const internalRow = feeRows.find(r => r.feeKind === 'INTERNAL')
  const externalRow = feeRows.find(r => r.feeKind === 'EXTERNAL')
  // Resolve outside the transaction — a stray category on a rollback is harmless.
  const needsCategory = (internalFee && !internalRow) || (externalFee && !externalRow)
  const feeCategoryId = needsCategory ? await ensureFeesCategory(userId) : null

  await db.transaction(async (tx) => {
    let parent = existing
    if (Object.keys(data).length > 0) {
      const [updated] = await tx
        .update(schema.transactions)
        .set(data)
        .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)))
        .returning()
      if (!updated) throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
      parent = updated
    }

    // Fee rows follow their parent's account/date so they never drift.
    const sync = { accountId: parent.accountId, currency: parent.currency, date: parent.date }
    const applyFee = async (
      kind: 'INTERNAL' | 'EXTERNAL',
      fee: number | null | undefined,
      feeRow: { id: string } | undefined,
    ) => {
      if (fee === undefined) {
        // Fee untouched — keep an existing fee row attached to the parent.
        if (feeRow) await tx.update(schema.transactions).set(sync).where(eq(schema.transactions.id, feeRow.id))
      } else if (!fee) {
        // null/0 — remove the fee.
        if (feeRow) await tx.delete(schema.transactions).where(eq(schema.transactions.id, feeRow.id))
      } else if (feeRow) {
        await tx
          .update(schema.transactions)
          .set({ ...sync, amount: toAmount(fee) })
          .where(eq(schema.transactions.id, feeRow.id))
      } else {
        await tx.insert(schema.transactions).values({
          userId,
          ...sync,
          type: 'EXPENSE',
          amount: toAmount(fee),
          categoryId: feeCategoryId,
          description: kind === 'INTERNAL' ? 'Internal fee' : 'External fee',
          feeOfId: id,
          feeKind: kind,
        })
      }
    }
    await applyFee('INTERNAL', internalFee, internalRow)
    await applyFee('EXTERNAL', externalFee, externalRow)
  })

  return db.query.transactions.findFirst({
    where: (tx, { eq }) => eq(tx.id, id),
    with: { account: true, category: true },
  })
})
