// Fetch-only wrapper for the per-account stats endpoint, mirroring
// useAnalytics.ts: no store — the existing stores' bare refreshNuxtData()
// after transaction/account mutations refreshes this key too. The key embeds
// both the account id and the range so queries never collide.

export interface AccountCategoryRow {
  categoryId: string | null
  name: string | null
  slug: string | null
  icon: string | null
  type: 'INCOME' | 'EXPENSE'
  total: number
  count: number
}

export function useAccountStats(id: string, months: Ref<number>) {
  return useFetch(`/api/v1/accounts/${id}/stats`, {
    key: computed(() => `account-stats:${id}:${months.value}`),
    query: computed(() => ({ months: months.value })),
    default: () => ({
      balanceHistory: [] as { date: string, balance: number }[],
      cashflow: [] as { month: string, income: number, expenses: number }[],
      categories: [] as AccountCategoryRow[],
      totals: { transactionCount: 0, thisMonthIncome: 0, thisMonthExpenses: 0, avgMonthlyNet: 0 },
      reconciliations: [] as { date: string, statedBalance: number }[],
    }),
  })
}
