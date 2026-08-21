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
  // Linked fees: the amounts of this row's fee rows (enriched by the list API),
  // and the parent id when this row IS a fee (fee rows can't nest fees).
  internalFee?: string | number | null
  externalFee?: string | number | null
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

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Refresh every loaded query after a mutation: derived balances ('accounts'),
  // goal progress, and any transaction list on screen, whatever filters it carries.
  const refreshAll = () => refreshNuxtData()

  // Create/update rethrow so the calling modal can stay open on failure.
  const createTransaction = (input: TransactionInput) => run({
    action: () => $fetch('/api/v1/transactions', { method: 'POST', body: input }),
    refresh: refreshAll,
    success: 'transactions.toasts.saved',
    failure: 'save',
    rethrow: true,
  })

  const updateTransaction = (id: string, input: Partial<TransactionInput>) => run({
    action: () => $fetch(`/api/v1/transactions/${id}`, { method: 'PATCH', body: input }),
    refresh: refreshAll,
    success: 'transactions.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // No rethrow: delete has no modal to keep open — the toast is the whole story.
  async function deleteTransaction(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/transactions/${id}`, { method: 'DELETE' }),
      refresh: refreshAll,
      success: 'transactions.toasts.deleted',
      failure: 'delete',
    })
    return result !== undefined
  }

  const createTransfer = (input: TransferInput) => run({
    action: () => $fetch('/api/v1/transfers', { method: 'POST', body: input }),
    refresh: refreshAll,
    success: 'transfers.toasts.complete',
    failure: 'transfers.toasts.failed',
    rethrow: true,
  })

  // --- Transaction modal (create/edit) ---
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<TransactionRow>()

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
    internalFee?: string | number | null
    externalFee?: string | number | null
  }): Promise<boolean> {
    const isTransfer = !!tx.transferId
    const hasFees = Number(tx.internalFee ?? 0) + Number(tx.externalFee ?? 0) > 0
    const feeNote = hasFees ? ` ${$i18n.t('transactions.confirmDelete.feeNote')}` : ''
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
