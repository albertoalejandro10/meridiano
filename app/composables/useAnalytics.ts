// Fetch-only wrappers for the read-only analytics endpoints. There is no
// analytics store: nothing here mutates, and the existing stores' bare
// refreshNuxtData() after transaction/account mutations refreshes these keys
// too. Keys are derived from the params (never share one key across queries).

export interface SpendingRow {
  currency: string
  categoryId: string | null
  name: string | null
  slug: string | null
  icon: string | null
  total: number
  count: number
  prevMonthTotal: number
  prevYearTotal: number
}

export function useSpending(month: Ref<string>, type: Ref<'INCOME' | 'EXPENSE'> = ref('EXPENSE')) {
  return useFetch('/api/v1/analytics/spending', {
    key: computed(() => `analytics:spending:${month.value}:${type.value}`),
    query: computed(() => ({ month: month.value, type: type.value })),
    default: () => ({ month: month.value, rows: [] as SpendingRow[] }),
  })
}

export function useCashflow(months: Ref<number>) {
  return useFetch('/api/v1/analytics/cashflow', {
    key: computed(() => `analytics:cashflow:${months.value}`),
    query: computed(() => ({ months: months.value })),
    default: () => ({ rows: [] }),
  })
}

export function useRecurring() {
  return useFetch('/api/v1/analytics/recurring', {
    key: 'analytics:recurring',
    default: () => ({ items: [] }),
  })
}

export interface ConversionRow {
  date: string
  fromAccount: string
  toAccount: string
  sentAmount: number
  sentCurrency: string
  receivedAmount: number
  receivedCurrency: string
  impliedRate: number
}

export interface FeeRouteRow {
  route: string
  fromAccount: string | null
  toAccount: string | null
  isTransfer: boolean
  currency: string
  internal: number
  external: number
  total: number
  count: number
}

export interface FeeDragRow {
  currency: string
  fees: number
  income: number
  drag: number | null
}

export function useMoneyMovement(months: Ref<number>) {
  return useFetch('/api/v1/analytics/money-movement', {
    key: computed(() => `analytics:money-movement:${months.value}`),
    query: computed(() => ({ months: months.value })),
    default: () => ({
      conversions: [] as ConversionRow[],
      fees: [] as FeeRouteRow[],
      drag: [] as FeeDragRow[],
    }),
  })
}

export function useNetWorthHistory(months: Ref<number>) {
  return useFetch('/api/v1/analytics/net-worth-history', {
    key: computed(() => `analytics:net-worth:${months.value}`),
    query: computed(() => ({ months: months.value })),
    default: () => ({ rows: [] }),
  })
}
