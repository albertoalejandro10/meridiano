import type { AccountInput, AccountType, ReconcileInput, SellAssetInput } from '~~/shared/schemas'

export const useAccountsStore = defineStore('accounts', () => {
  const { data: accounts, refresh, status } = useFetch('/api/v1/accounts', {
    key: 'accounts',
    default: () => [],
  })

  type Account = typeof accounts.value[number]

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Account mutations change data derived elsewhere (goal progress sums linked
  // balances; transaction rows embed the account name), so refresh every loaded
  // query, not just the accounts list.
  const refreshAll = () => refreshNuxtData()

  // Create/update rethrow so the calling modal can stay open on failure.
  const createAccount = (input: AccountInput) => run({
    action: () => $fetch('/api/v1/accounts', { method: 'POST', body: input }),
    refresh: refreshAll,
    success: 'accounts.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateAccount = (id: string, input: Partial<AccountInput>) => run({
    action: () => $fetch(`/api/v1/accounts/${id}`, { method: 'PATCH', body: input }),
    refresh: refreshAll,
    success: 'accounts.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // No rethrow: there is no modal to keep open — the toast (and the boolean,
  // for callers that navigate afterwards) is the whole story. A 409 means the
  // account still has transactions, which deserves its own explanation.
  async function deleteAccount(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/accounts/${id}`, { method: 'DELETE' }),
      refresh: refreshAll,
      success: 'accounts.toasts.deleted',
      failure: e => errorStatus(e) === 409
        ? {
            title: $i18n.t('accounts.toasts.hasTransactions.title'),
            description: $i18n.t('accounts.toasts.hasTransactions.description'),
          }
        : { title: $i18n.t('common.toasts.deleteFailed'), description: errorMessage(e) },
    })
    return result !== undefined
  }

  const sellAsset = (assetId: string, input: SellAssetInput) => run({
    action: () => $fetch(`/api/v1/accounts/${assetId}/sell`, { method: 'POST', body: input }),
    refresh: refreshAll,
    success: 'accounts.toasts.sold',
    failure: 'accounts.toasts.saleFailed',
    rethrow: true,
  })

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

  // Rethrows like create/update so the reconcile modal stays open on failure.
  // Refreshes everything, not just the accounts list: the detail page's
  // reconciliation history is its own `account-stats:…` key.
  // The modal only sets applyAdjustment when there's a real difference to close,
  // so the toast never claims a correction that didn't happen.
  const reconcileAccount = (id: string, input: ReconcileInput) => run({
    action: () => $fetch(`/api/v1/accounts/${id}/reconcile`, { method: 'POST', body: input }),
    refresh: refreshAll,
    success: input.applyAdjustment ? 'accounts.toasts.balanceAdjusted' : 'accounts.toasts.reconciled',
    failure: 'accounts.toasts.reconcileFailed',
    rethrow: true,
  })

  // One-click "nothing's missing": a checkpoint at the balance the user is
  // looking at, which resets the staleness clock. No rethrow — there's no modal
  // to keep open, the toast is the whole story.
  const confirmUpToDate = (account: { id: string, balance: number }) => run({
    action: () => $fetch(`/api/v1/accounts/${account.id}/reconcile`, {
      method: 'POST',
      // Local 'yyyy-MM-dd' like the reconcile modal sends — a raw Date would
      // serialize as UTC and land on tomorrow's checkpoint late in the evening.
      body: { statedBalance: account.balance, date: toISODate(new Date()) },
    }),
    refresh: refreshAll,
    success: 'accounts.toasts.confirmedUpToDate',
    failure: 'accounts.toasts.reconcileFailed',
  })

  // --- Sell-asset modal ---
  const sellModalOpen = ref(false)
  const sellingAsset = ref<Account | undefined>()

  function openSell(account: Account) {
    sellingAsset.value = account
    sellModalOpen.value = true
  }

  // --- Reconcile modal ---
  const reconcileModalOpen = ref(false)
  const reconcilingAccount = ref<Account | undefined>()

  function openReconcile(account: Account) {
    reconcilingAccount.value = account
    reconcileModalOpen.value = true
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
    reconcileAccount,
    confirmUpToDate,
    reconcileModalOpen,
    reconcilingAccount,
    openReconcile,
    confirmDelete,
  }
})
