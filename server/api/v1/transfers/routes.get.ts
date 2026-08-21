import { db, schema } from '@nuxthub/db'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

export interface TransferRoute {
  fromAccountId: string
  toAccountId: string
  count: number
  // Carried over from the most recent transfer on this route — what the user
  // last typed, not an average. A fee that changed is corrected by the next one.
  description: string | null
  internalFee: number | null
  externalFee: number | null
  lastDate: string
}

// How far back to look, and how many routes to offer. A route the user stopped
// using drops off on its own as newer transfers push it out of the window.
const MAX_TRANSFERS = 200
const MAX_ROUTES = 5

/**
 * The transfer routes the user actually repeats, so the transfer form can offer
 * them as one-click prefills instead of asking for the same four accounts,
 * description and fees every time.
 *
 * Deliberately derived rather than stored in a `transfer_routes` table: a route
 * is a fact about history, so querying it means there is no CRUD to build, no
 * stale saved route to prune, and no way for the list to disagree with reality.
 *
 * Joins the transfer pair back together the same way computeConversions does
 * (server/utils/moneyMovement.ts) — the EXPENSE leg is the source, the INCOME
 * leg the destination. The fee joins can't fan out: the unique index on
 * (fee_of_id, fee_kind) allows at most one fee row per leg per kind.
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  const expense = alias(schema.transactions, 'expense_leg')
  const income = alias(schema.transactions, 'income_leg')
  const internal = alias(schema.transactions, 'internal_fee')
  const external = alias(schema.transactions, 'external_fee')
  const source = alias(schema.accounts, 'source_account')
  const destination = alias(schema.accounts, 'destination_account')

  const rows = await db
    .select({
      fromAccountId: expense.accountId,
      toAccountId: income.accountId,
      description: expense.description,
      date: expense.date,
      internalFee: internal.amount,
      externalFee: external.amount,
    })
    .from(expense)
    .innerJoin(income, and(eq(income.transferId, expense.transferId), eq(income.type, 'INCOME')))
    // INTERNAL hangs off the source leg, EXTERNAL off the destination leg —
    // the split written by transfers/index.post.ts.
    .leftJoin(internal, and(eq(internal.feeOfId, expense.id), eq(internal.feeKind, 'INTERNAL')))
    .leftJoin(external, and(eq(external.feeOfId, income.id), eq(external.feeKind, 'EXTERNAL')))
    .innerJoin(source, eq(source.id, expense.accountId))
    .innerJoin(destination, eq(destination.id, income.accountId))
    .where(and(
      eq(expense.userId, userId),
      eq(expense.type, 'EXPENSE'),
      isNotNull(expense.transferId),
      // An archived account can't take part in a new transfer, so a route
      // through one is dead. This also drops asset sales — "Laptop HP → Binance"
      // is a one-off that archived its source, never a route to repeat.
      eq(source.archived, false),
      eq(destination.archived, false),
    ))
    // Newest first, so the first sighting of a route below is its latest use.
    // createdAt breaks ties between same-day transfers.
    .orderBy(desc(expense.date), desc(expense.createdAt))
    .limit(MAX_TRANSFERS)

  const routes = new Map<string, TransferRoute>()
  for (const r of rows) {
    const key = `${r.fromAccountId}:${r.toAccountId}`
    const existing = routes.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    routes.set(key, {
      fromAccountId: r.fromAccountId,
      toAccountId: r.toAccountId,
      count: 1,
      description: r.description,
      internalFee: r.internalFee == null ? null : Number(r.internalFee),
      externalFee: r.externalFee == null ? null : Number(r.externalFee),
      lastDate: r.date,
    })
  }

  // Frequency first — the pipeline the user repeats — with recency as the
  // tie-break so two equally-used routes keep a stable, sensible order.
  return [...routes.values()]
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, MAX_ROUTES)
})
