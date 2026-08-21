export interface TransactionFilters {
  accountId?: string
  // A category id, or 'none' for uncategorized rows.
  categoryId?: string
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
    const parts = [f.accountId, f.categoryId, f.type, f.from, f.to].filter(Boolean)
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

export interface FeeDefaults {
  internal: number | null
  external: number | null
}

// The last fee paid per account, keyed by account id — what the entry forms
// offer instead of asking for a number the user has already typed before.
// Derived server-side from history, so the bare refreshNuxtData() the stores
// already run after every mutation keeps it current.
export function useFeeDefaults() {
  return useFetch('/api/v1/accounts/fee-defaults', {
    // Typed rather than a bare {}: an untyped empty default widens the result
    // to a union with no index signature, so accountId lookups stop compiling.
    default: (): Record<string, FeeDefaults> => ({}),
    key: 'accounts:fee-defaults',
  })
}

// The transfer routes the user repeats, newest-and-most-used first, each
// carrying the description and fees from its last use.
export function useTransferRoutes() {
  return useFetch('/api/v1/transfers/routes', {
    key: 'transfers:routes',
    default: () => [],
  })
}
