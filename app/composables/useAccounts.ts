import type { AccountInput } from '~~/shared/schemas'

export function useAccounts() {
  const { data: accounts, refresh, status } = useFetch('/api/v1/accounts', {
    key: 'accounts',
    default: () => [],
  })

  const toast = useToast()

  async function createAccount(input: AccountInput) {
    await $fetch('/api/v1/accounts', { method: 'POST', body: input })
    await refresh()
    toast.add({ title: 'Account created', color: 'success' })
  }

  async function updateAccount(id: string, input: Partial<AccountInput>) {
    await $fetch(`/api/v1/accounts/${id}`, { method: 'PATCH', body: input })
    await refresh()
    toast.add({ title: 'Account updated', color: 'success' })
  }

  async function deleteAccount(id: string) {
    try {
      await $fetch(`/api/v1/accounts/${id}`, { method: 'DELETE' })
      await refresh()
      toast.add({ title: 'Account deleted', color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { statusCode?: number, statusMessage?: string }
      toast.add({
        title: err.statusCode === 409 ? 'Account has transactions' : 'Delete failed',
        description: err.statusCode === 409 ? 'Archive it instead.' : err.statusMessage,
        color: 'error',
      })
    }
  }

  return { accounts, refresh, status, createAccount, updateAccount, deleteAccount }
}
