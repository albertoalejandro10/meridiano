import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { transactionUpdateSchema } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
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
  if (existing.feeOfId && body.fee !== undefined) {
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

  // `fee` is not a column — it drives the linked fee row below.
  const { amount, date, fee, ...rest } = body
  const data = {
    ...rest,
    ...(amount !== undefined && { amount: toAmount(amount) }),
    ...(date !== undefined && { date: toDateStr(date) }),
    ...(currency && { currency }),
  }
  if (Object.keys(data).length === 0 && fee === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const feeRow = existing.feeOfId
    ? null
    : await db.query.transactions.findFirst({
        where: (tx, { eq }) => eq(tx.feeOfId, id),
        columns: { id: true },
      })
  // Resolve outside the transaction — a stray category on a rollback is harmless.
  const feeCategoryId = fee && !feeRow ? await ensureFeesCategory(userId) : null

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

    // The fee row follows its parent's account/date so it never drifts.
    const sync = { accountId: parent.accountId, currency: parent.currency, date: parent.date }
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
        description: 'Fee',
        feeOfId: id,
      })
    }
  })

  return db.query.transactions.findFirst({
    where: (tx, { eq }) => eq(tx.id, id),
    with: { account: true, category: true },
  })
})
