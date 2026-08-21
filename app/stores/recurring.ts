import type { Cadence, OccurrenceStatus, RecurringConfirmItem, RecurringInput, TransactionType } from '~~/shared/schemas'

// A recurring template as served by /api/v1/recurring. `amount` is the optional
// estimate — the charged figure lives on the transactions each answer creates.
export interface RecurringTemplate {
  id: string
  accountId: string
  categoryId: string | null
  type: TransactionType
  amount: number | null
  description: string
  cadence: Cadence
  startDate: string
  endDate: string | null
  enabled: boolean
  account: { id: string, name: string, currency: string, archived: boolean }
  category: { id: string, name: string, slug: string | null, icon: string | null } | null
}

// A derived due date, pending an answer (or still ahead of us, for `upcoming`).
export interface RecurringOccurrence {
  recurringId: string
  description: string
  dueDate: string
  type: TransactionType
  accountId: string
  accountName: string
  currency: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  estimate: number | null
  lastPaidAmount: number | null
}

// An answered due date, for the history list.
export interface RecurringAnswer {
  id: string
  recurringId: string
  description: string
  dueDate: string
  status: OccurrenceStatus
  note: string | null
  transactionId: string | null
  amount: number | null
  currency: string | null
}

// Prefill for the create modal — how a detected subscription on the analytics
// page becomes a tracked template in one click.
export type RecurringPrefill = Partial<Pick<
  RecurringTemplate,
  'description' | 'cadence' | 'amount' | 'categoryId' | 'accountId' | 'startDate' | 'type'
>>

export const useRecurringStore = defineStore('recurring', () => {
  const { data, refresh, status } = useFetch('/api/v1/recurring', {
    key: 'recurring',
    default: () => ({
      templates: [] as RecurringTemplate[],
      pending: [] as RecurringOccurrence[],
      upcoming: [] as RecurringOccurrence[],
      history: [] as RecurringAnswer[],
    }),
  })

  const templates = computed(() => data.value.templates)
  const pending = computed(() => data.value.pending)
  const upcoming = computed(() => data.value.upcoming)
  const history = computed(() => data.value.history)

  const toast = useToast()
  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup.
  const { $i18n } = useNuxtApp()

  // Create/update rethrow so the calling modal can stay open on failure.
  // Templates are leaf data (they only decide what gets *asked*), so only this
  // key refreshes — no transaction has been written.
  const createRecurring = (input: RecurringInput) => run({
    action: () => $fetch('/api/v1/recurring', { method: 'POST', body: input }),
    refresh,
    success: 'recurring.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateRecurring = (id: string, input: Partial<RecurringInput>) => run({
    action: () => $fetch(`/api/v1/recurring/${id}`, { method: 'PATCH', body: input }),
    refresh,
    success: 'recurring.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  const deleteRecurring = (id: string) => run({
    action: () => $fetch(`/api/v1/recurring/${id}`, { method: 'DELETE' }),
    refresh,
    success: 'recurring.toasts.deleted',
    failure: 'delete',
  })

  // Answering writes transactions → every loaded list and derived balance,
  // analytics figure and budget refetches (bare refreshNuxtData()). The counts
  // in the toast come from the response, so this one reports success itself.
  async function confirmOccurrences(items: RecurringConfirmItem[]) {
    // Rethrows on failure so the review modal stays open for another attempt.
    const { created, skipped } = await run({
      action: () => $fetch('/api/v1/recurring/confirm', { method: 'POST', body: { items } }),
      refresh: () => refreshNuxtData(),
      failure: 'save',
      rethrow: true,
    })

    toast.add({ title: $i18n.t('recurring.toasts.confirmed', { created, skipped }), color: 'success' })
  }

  async function undoOccurrence(answer: RecurringAnswer) {
    const confirmed = await confirm({
      title: $i18n.t('recurring.confirmUndo.title'),
      // A paid answer takes its transaction with it — spell that out.
      message: answer.transactionId
        ? $i18n.t('recurring.confirmUndo.messagePaid', { description: answer.description })
        : $i18n.t('recurring.confirmUndo.message', { description: answer.description }),
    })
    if (!confirmed) return

    await run({
      action: () => $fetch(`/api/v1/recurring/occurrences/${answer.id}`, { method: 'DELETE' }),
      refresh: () => refreshNuxtData(),
      success: 'recurring.toasts.undone',
      failure: 'delete',
    })
  }

  // --- Template modal (create/edit) ---
  // The prefill is how a detected subscription on the analytics page becomes a
  // tracked template in one click.
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<RecurringTemplate | RecurringPrefill, RecurringPrefill>()

  async function confirmDelete(template: RecurringTemplate) {
    const confirmed = await confirm({
      title: $i18n.t('recurring.confirmDelete.title'),
      message: $i18n.t('recurring.confirmDelete.message', { description: template.description }),
    })
    if (confirmed) await deleteRecurring(template.id)
  }

  // --- Review modal ("did you pay these?") ---
  const reviewOpen = ref(false)

  return {
    templates,
    pending,
    upcoming,
    history,
    refresh,
    status,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    confirmOccurrences,
    undoOccurrence,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    confirmDelete,
    reviewOpen,
  }
})
