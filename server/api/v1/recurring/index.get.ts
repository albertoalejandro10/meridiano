import { db } from '@nuxthub/db'

// Templates + everything derived from them in one round-trip (same shape as
// tasks/index.get.ts shipping `previousPending` alongside the month): the page,
// the dashboard banner and the budgets "committed" figure all read this key.
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const [templates, pending, upcoming, history] = await Promise.all([
    db.query.recurringTransactions.findMany({
      where: (r, { eq }) => eq(r.userId, userId),
      with: { account: true, category: true },
      orderBy: (r, { asc }) => [asc(r.description)],
    }),
    pendingOccurrences(userId),
    upcomingOccurrences(userId),
    // Recent answers, for the history list and its undo action.
    db.query.recurringOccurrences.findMany({
      where: (o, { eq }) => eq(o.userId, userId),
      with: {
        recurring: { columns: { description: true } },
        transaction: { columns: { amount: true, currency: true } },
      },
      orderBy: (o, { desc }) => [desc(o.dueDate), desc(o.createdAt)],
      limit: 50,
    }),
  ])

  return {
    templates: templates.map(t => ({
      ...t,
      // numeric(14, 2) comes back as a string; null when no estimate was given.
      amount: t.amount === null ? null : Number(t.amount),
    })),
    pending,
    upcoming,
    history: history.map(o => ({
      id: o.id,
      recurringId: o.recurringId,
      description: o.recurring.description,
      dueDate: o.dueDate,
      status: o.status,
      note: o.note,
      transactionId: o.transactionId,
      amount: o.transaction ? Number(o.transaction.amount) : null,
      currency: o.transaction?.currency ?? null,
    })),
  }
})
