import { db, schema } from '@nuxthub/db'
import { eq, sum } from 'drizzle-orm'
import { isLiabilityType } from '~~/shared/schemas'

type Account = typeof schema.accounts.$inferSelect
export type AccountWithBalance = Account & { balance: number }

/**
 * The user's accounts with their *derived* balance (balances are never stored).
 *
 * Asset:     balance = initialBalance + Σ(INCOME) − Σ(EXPENSE)
 * Liability: balance = initialBalance + Σ(EXPENSE) − Σ(INCOME)  (positive "amount owed")
 *
 * Single source of truth shared by the accounts and goals endpoints.
 */
export async function accountsWithBalance(userId: string): Promise<AccountWithBalance[]> {
  const [accounts, sums] = await Promise.all([
    db.query.accounts.findMany({
      where: (a, { eq }) => eq(a.userId, userId),
      orderBy: (a, { asc }) => asc(a.createdAt),
    }),
    db
      .select({
        accountId: schema.transactions.accountId,
        type: schema.transactions.type,
        total: sum(schema.transactions.amount),
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .groupBy(schema.transactions.accountId, schema.transactions.type),
  ])

  return accounts.map((account) => {
    const expenseSign = isLiabilityType(account.type) ? 1 : -1
    let balance = Number(account.initialBalance)
    for (const s of sums) {
      if (s.accountId !== account.id) continue
      const amount = Number(s.total ?? 0)
      balance += s.type === 'EXPENSE' ? expenseSign * amount : -expenseSign * amount
    }
    return { ...account, balance }
  })
}
