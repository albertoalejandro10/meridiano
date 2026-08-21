import { db, schema } from '@nuxthub/db'
import { and, desc, eq, isNotNull } from 'drizzle-orm'

export interface FeeDefaults {
  internal: number | null
  external: number | null
}

/**
 * The last fee actually paid per (account, kind), so the transaction and
 * transfer forms can offer it instead of asking again.
 *
 * Derived from history rather than stored: what a platform charges is a fact
 * about what already happened, so there is no preference row to keep in sync
 * and nothing to clean up when a fee changes — the next transfer moves it.
 *
 * Which account a fee belongs to is set by transfers/index.post.ts: INTERNAL
 * lands on the source, EXTERNAL on the destination. Callers key the lookup the
 * same way.
 */
export default defineEventHandler(async (event) => {
  const userId = event.context.userId

  // DISTINCT ON keeps the first row of each (accountId, feeKind) group under
  // the given order — the most recent fee of that kind on that account. Same
  // shape as the reconciliation lookup in server/utils/balances.ts.
  const rows = await db
    .selectDistinctOn([schema.transactions.accountId, schema.transactions.feeKind], {
      accountId: schema.transactions.accountId,
      feeKind: schema.transactions.feeKind,
      amount: schema.transactions.amount,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.userId, userId),
      isNotNull(schema.transactions.feeOfId),
      isNotNull(schema.transactions.feeKind),
    ))
    .orderBy(
      schema.transactions.accountId,
      schema.transactions.feeKind,
      desc(schema.transactions.date),
      desc(schema.transactions.createdAt),
    )

  const defaults: Record<string, FeeDefaults> = {}
  for (const row of rows) {
    const entry = defaults[row.accountId] ??= { internal: null, external: null }
    if (row.feeKind === 'INTERNAL') entry.internal = Number(row.amount)
    else entry.external = Number(row.amount)
  }
  return defaults
})
