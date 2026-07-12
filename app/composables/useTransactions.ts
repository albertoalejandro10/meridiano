export interface TransactionFilters {
  accountId?: string
  type?: 'INCOME' | 'EXPENSE'
  from?: string
  to?: string
}

// Filter-keyed transaction list. Fetch-only: mutations live on the transactions
// store (useTransactionsStore), whose refreshNuxtData() reaches every key here.
export function useTransactions(filters?: Ref<TransactionFilters>) {
  const query = computed(() => ({
    limit: 50,
    ...(filters?.value ?? {}),
  }))

  // The key must track the query: consumers with different filters (dashboard vs
  // filtered list) would otherwise share one cache entry and clobber each other.
  const key = computed(() => {
    const f = filters?.value ?? {}
    const parts = [f.accountId, f.type, f.from, f.to].filter(Boolean)
    return parts.length ? `transactions:${parts.join(':')}` : 'transactions'
  })

  return useFetch('/api/v1/transactions', {
    key,
    query,
    default: () => ({ items: [], nextCursor: null }),
  })
}

export function useCategories() {
  return useFetch('/api/v1/categories', {
    key: 'categories',
    default: () => [],
  })
}
