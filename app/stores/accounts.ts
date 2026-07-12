import type { AccountInput, AccountType, SellAssetInput } from '~~/shared/schemas'

export const useAccountsStore = defineStore('accounts', () => {
  const { data: accounts, refresh, status } = useFetch('/api/v1/accounts', {
    key: 'accounts',
    default: () => [],
  })

  type Account = typeof accounts.value[number]

  const toast = useToast()
  const { confirm } = useConfirm()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Account mutations change data derived elsewhere (goal progress sums linked
  // balances; transaction rows embed the account name), so refresh every loaded
  // query, not just the accounts list.
  async function refreshAll() {
    await refreshNuxtData()
  }

  // Create/update rethrow so the calling modal can stay open on failure.
  async function createAccount(input: AccountInput) {
    try {
      await $fetch('/api/v1/accounts', { method: 'POST', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('accounts.toasts.created'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.createFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  async function updateAccount(id: string, input: Partial<AccountInput>) {
    try {
      await $fetch(`/api/v1/accounts/${id}`, { method: 'PATCH', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('accounts.toasts.updated'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.updateFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  // No rethrow: there is no modal to keep open — the toast (and the boolean,
  // for callers that navigate afterwards) is the whole story.
  async function deleteAccount(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/v1/accounts/${id}`, { method: 'DELETE' })
      await refreshAll()
      toast.add({ title: $i18n.t('accounts.toasts.deleted'), color: 'success' })
      return true
    }
    catch (e: unknown) {
      const err = e as { statusCode?: number, statusMessage?: string }
      toast.add({
        title: err.statusCode === 409 ? $i18n.t('accounts.toasts.hasTransactions.title') : $i18n.t('common.toasts.deleteFailed'),
        description: err.statusCode === 409 ? $i18n.t('accounts.toasts.hasTransactions.description') : err.statusMessage,
        color: 'error',
      })
      return false
    }
  }

  async function sellAsset(assetId: string, input: SellAssetInput) {
    try {
      await $fetch(`/api/v1/accounts/${assetId}/sell`, { method: 'POST', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('accounts.toasts.sold'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('accounts.toasts.saleFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  // --- Account modal (create/edit) ---
  const modalOpen = ref(false)
  const editing = ref<Account | undefined>()
  // Which account types the modal's picker offers, based on where it was opened from.
  const modalGroup = ref<'asset' | 'liability' | 'all'>('all')
  // Pre-select a specific type (e.g. the "Add investment" button on a type group).
  const modalType = ref<AccountType | undefined>()

  function openCreate(opts?: { group?: 'asset' | 'liability' | 'all', type?: AccountType }) {
    editing.value = undefined
    modalGroup.value = opts?.group ?? 'all'
    modalType.value = opts?.type
    modalOpen.value = true
  }

  function openEdit(account: Account) {
    editing.value = account
    modalGroup.value = 'all'
    modalType.value = undefined
    modalOpen.value = true
  }

  // --- Sell-asset modal ---
  const sellModalOpen = ref(false)
  const sellingAsset = ref<Account | undefined>()

  function openSell(account: Account) {
    sellingAsset.value = account
    sellModalOpen.value = true
  }

  async function confirmDelete(account: { id: string, name: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('accounts.confirmDelete.title'),
      message: $i18n.t('accounts.confirmDelete.message', { name: account.name }),
    })
    return confirmed ? await deleteAccount(account.id) : false
  }

  return {
    accounts,
    refresh,
    status,
    createAccount,
    updateAccount,
    deleteAccount,
    sellAsset,
    modalOpen,
    editing,
    modalGroup,
    modalType,
    openCreate,
    openEdit,
    sellModalOpen,
    sellingAsset,
    openSell,
    confirmDelete,
  }
})
