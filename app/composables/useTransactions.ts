import type { TransactionInput } from '~~/shared/schemas'

export interface TransactionFilters {
  accountId?: string
  type?: 'INCOME' | 'EXPENSE'
  from?: string
  to?: string
}

export function useTransactions(filters?: Ref<TransactionFilters>) {
  const query = computed(() => ({
    limit: 50,
    ...(filters?.value ?? {}),
  }))

  const { data, refresh, status } = useFetch('/api/v1/transactions', {
    key: 'transactions',
    query,
    default: () => ({ items: [], nextCursor: null }),
  })

  const toast = useToast()

  async function createTransaction(input: TransactionInput) {
    await $fetch('/api/v1/transactions', { method: 'POST', body: input })
    await Promise.all([refresh(), refreshNuxtData('accounts')])
    toast.add({ title: 'Transaction saved', color: 'success' })
  }

  async function updateTransaction(id: string, input: Partial<TransactionInput>) {
    await $fetch(`/api/v1/transactions/${id}`, { method: 'PATCH', body: input })
    await Promise.all([refresh(), refreshNuxtData('accounts')])
    toast.add({ title: 'Transaction updated', color: 'success' })
  }

  async function deleteTransaction(id: string) {
    await $fetch(`/api/v1/transactions/${id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshNuxtData('accounts')])
    toast.add({ title: 'Transaction deleted', color: 'success' })
  }

  return { data, refresh, status, createTransaction, updateTransaction, deleteTransaction }
}

export function useCategories() {
  return useFetch('/api/v1/categories', {
    key: 'categories',
    default: () => [],
  })
}
