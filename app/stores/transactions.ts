import type { TransactionInput, TransferInput } from '~~/shared/schemas'

// Row shape the transaction modal edits — satisfied by items from any
// transactions list (the store's base page or a filter-keyed page list).
export interface TransactionRow {
  id: string
  accountId: string
  categoryId: string | null
  type: 'INCOME' | 'EXPENSE'
  amount: string | number
  date: string
  description: string | null
  // Linked fee: the amount of this row's fee row (enriched by the list API),
  // and the parent id when this row IS a fee (fee rows can't nest fees).
  fee?: string | number | null
  feeOfId?: string | null
}

export const useTransactionsStore = defineStore('transactions', () => {
  // Base (unfiltered) first page — what the dashboard consumes. Filtered lists
  // keep their own filter-derived useFetch keys via useTransactions(filters);
  // they still refetch after mutations because we refresh every loaded query.
  const { data, refresh, status } = useFetch('/api/v1/transactions', {
    key: 'transactions',
    query: { limit: 50 },
    default: () => ({ items: [], nextCursor: null }),
  })

  const toast = useToast()
  const { confirm } = useConfirm()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Refresh every loaded query after a mutation: derived balances ('accounts'),
  // goal progress, and any transaction list on screen, whatever filters it carries.
  async function refreshAll() {
    await refreshNuxtData()
  }

  // Create/update rethrow so the calling modal can stay open on failure.
  async function createTransaction(input: TransactionInput) {
    try {
      await $fetch('/api/v1/transactions', { method: 'POST', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('transactions.toasts.saved'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.saveFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  async function updateTransaction(id: string, input: Partial<TransactionInput>) {
    try {
      await $fetch(`/api/v1/transactions/${id}`, { method: 'PATCH', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('transactions.toasts.updated'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.updateFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  // No rethrow: delete has no modal to keep open — the toast is the whole story.
  async function deleteTransaction(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/v1/transactions/${id}`, { method: 'DELETE' })
      await refreshAll()
      toast.add({ title: $i18n.t('transactions.toasts.deleted'), color: 'success' })
      return true
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.deleteFailed'), description: err.data?.statusMessage, color: 'error' })
      return false
    }
  }

  async function createTransfer(input: TransferInput) {
    try {
      await $fetch('/api/v1/transfers', { method: 'POST', body: input })
      await refreshAll()
      toast.add({ title: $i18n.t('transfers.toasts.complete'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('transfers.toasts.failed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  // --- Transaction modal (create/edit) ---
  const modalOpen = ref(false)
  const editing = ref<TransactionRow | undefined>()

  function openCreate() {
    editing.value = undefined
    modalOpen.value = true
  }

  function openEdit(tx: TransactionRow) {
    editing.value = tx
    modalOpen.value = true
  }

  // --- Transfer modal ---
  const transferModalOpen = ref(false)

  function openTransfer() {
    transferModalOpen.value = true
  }

  // Deleting either leg of a transfer deletes both — the copy says so.
  async function confirmDelete(tx: {
    id: string
    transferId?: string | null
    type: 'INCOME' | 'EXPENSE'
    amount: string | number
    currency: string
    fee?: string | number | null
  }): Promise<boolean> {
    const isTransfer = !!tx.transferId
    const feeNote = Number(tx.fee ?? 0) > 0 ? ` ${$i18n.t('transactions.confirmDelete.feeNote')}` : ''
    const amount = formatMoney(Number(tx.amount), tx.currency, NUMBER_LOCALES[$i18n.locale.value])
    const confirmed = await confirm({
      title: isTransfer ? $i18n.t('transactions.confirmDelete.transferTitle') : $i18n.t('transactions.confirmDelete.title'),
      message: (isTransfer
        ? $i18n.t('transactions.confirmDelete.transferMessage', { amount })
        : $i18n.t(tx.type === 'INCOME' ? 'transactions.confirmDelete.incomeMessage' : 'transactions.confirmDelete.expenseMessage', { amount })
      ) + feeNote,
    })
    return confirmed ? await deleteTransaction(tx.id) : false
  }

  return {
    data,
    refresh,
    status,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    createTransfer,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    transferModalOpen,
    openTransfer,
    confirmDelete,
  }
})
