import { db, schema } from '@nuxthub/db'
import { recurringConfirmSchema } from '~~/shared/schemas'

// Answer a batch of due occurrences — the only thing that turns a derived due
// date into stored data.
//   PAID    → a real transaction on the template's account, at the amount the
//             user typed (not the estimate), plus the answer row linking them.
//   SKIPPED → the answer row alone: no charge landed on this account (cancelled,
//             waived, or a family member paid it), with an optional note.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const { items } = await readValidatedBody(event, recurringConfirmSchema.parse)

  const templates = await db.query.recurringTransactions.findMany({
    where: (r, { and, eq, inArray }) => and(
      eq(r.userId, userId),
      inArray(r.id, [...new Set(items.map(i => i.recurringId))]),
    ),
    with: { account: { columns: { id: true, currency: true } } },
  })
  const byId = new Map(templates.map(t => [t.id, t]))
  for (const item of items) {
    if (!byId.has(item.recurringId)) {
      throw createError({ statusCode: 404, statusMessage: 'Recurring payment not found' })
    }
  }

  const categoryIds = [...new Set(items.map(i => i.categoryId).filter(id => id != null))]
  await Promise.all(categoryIds.map(id => requireOwnCategory(userId, id)))

  // Drop occurrences already answered so a double-submitted review is a no-op
  // rather than a 409. The unique (recurringId, dueDate) index still backstops
  // a genuine concurrent race — that one aborts the whole transaction below,
  // leaving no half-written transactions behind.
  const answered = await db.query.recurringOccurrences.findMany({
    where: (o, { and, eq, inArray }) => and(
      eq(o.userId, userId),
      inArray(o.recurringId, [...byId.keys()]),
    ),
    columns: { recurringId: true, dueDate: true },
  })
  const answeredKeys = new Set(answered.map(o => `${o.recurringId}:${o.dueDate}`))

  const rules = await getActiveRules(userId)
  const transactionRows: (typeof schema.transactions.$inferInsert)[] = []
  const occurrenceRows: (typeof schema.recurringOccurrences.$inferInsert)[] = []

  for (const item of items) {
    const template = byId.get(item.recurringId)!
    const dueDate = toDateStr(item.dueDate)
    if (answeredKeys.has(`${item.recurringId}:${dueDate}`)) continue
    answeredKeys.add(`${item.recurringId}:${dueDate}`)

    if (item.status === 'SKIPPED') {
      occurrenceRows.push({
        userId,
        recurringId: template.id,
        dueDate,
        status: 'SKIPPED',
        note: item.note ?? null,
      })
      continue
    }

    // Same construction as transactions/index.post.ts: the id is generated here
    // so the occurrence row can reference it in the same batch, the currency
    // always comes from the account, and rules fill a still-missing category.
    const id = crypto.randomUUID()
    const categoryId = item.categoryId
      ?? template.categoryId
      ?? matchCategory(template.description, template.type, rules)

    transactionRows.push({
      id,
      userId,
      accountId: template.accountId,
      categoryId,
      type: template.type,
      amount: toAmount(item.amount!),
      currency: template.account.currency,
      // The day it was actually paid may differ from the day it came due.
      date: item.date ? toDateStr(item.date) : dueDate,
      description: template.description,
      recurringId: template.id,
    })
    occurrenceRows.push({
      userId,
      recurringId: template.id,
      dueDate,
      status: 'PAID',
      transactionId: id,
      note: item.note ?? null,
    })
  }

  if (!occurrenceRows.length) return { created: 0, skipped: 0 }

  try {
    await db.transaction(async (tx) => {
      // Transactions first: the occurrence FK needs its target to exist.
      if (transactionRows.length) await tx.insert(schema.transactions).values(transactionRows)
      await tx.insert(schema.recurringOccurrences).values(occurrenceRows)
    })
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'Some of these occurrences were just answered elsewhere' })
    }
    throw err
  }

  return {
    created: transactionRows.length,
    skipped: occurrenceRows.length - transactionRows.length,
  }
})
