import type { TransactionRuleInput } from '~~/shared/schemas'

// Rule rows as served by /api/v1/rules (priority ascending).
export interface TransactionRule {
  id: string
  keyword: string
  categoryId: string
  enabled: boolean
  priority: number
  category: { id: string, name: string, slug: string | null, icon: string | null, type: string | null }
}

export const useRulesStore = defineStore('rules', () => {
  const { data: rules, refresh, status } = useFetch('/api/v1/rules', {
    key: 'rules',
    default: () => [] as TransactionRule[],
  })

  const toast = useToast()
  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup.
  const { $i18n } = useNuxtApp()

  // Create/update rethrow so the calling modal can stay open on failure.
  // Rules are leaf data (they only affect future writes) — only this key refreshes.
  const createRule = (input: TransactionRuleInput) => run({
    action: () => $fetch('/api/v1/rules', { method: 'POST', body: input }),
    refresh,
    success: 'rules.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateRule = (id: string, input: Partial<TransactionRuleInput>) => run({
    action: () => $fetch(`/api/v1/rules/${id}`, { method: 'PATCH', body: input }),
    refresh,
    success: 'rules.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  const deleteRule = (id: string) => run({
    action: () => $fetch(`/api/v1/rules/${id}`, { method: 'DELETE' }),
    refresh,
    success: 'rules.toasts.deleted',
    failure: 'delete',
  })

  // Full ordered id list (array index becomes the priority). Silent on success
  // (the new order is its own feedback); refreshes on failure too, so a rejected
  // drag snaps back to the stored order.
  const reorder = (ids: string[]) => run({
    action: () => $fetch('/api/v1/rules/reorder', { method: 'PUT', body: { ids } }),
    refresh,
    failure: 'save',
    refreshOnError: true,
  })

  // Retroactively categorize existing uncategorized transactions.
  async function applyToExisting() {
    const confirmed = await confirm({
      title: $i18n.t('rules.applyConfirm.title'),
      message: $i18n.t('rules.applyConfirm.message'),
    })
    if (!confirmed) return

    const result = await run({
      action: () => $fetch('/api/v1/rules/apply', { method: 'POST' }),
      failure: 'save',
    })
    if (!result) return

    toast.add({ title: $i18n.t('rules.toasts.applied', result.updated), color: 'success' })
    // Transactions changed → every loaded list/aggregation refetches.
    if (result.updated > 0) await refreshNuxtData()
  }

  // --- Rule modal (create/edit) ---
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<TransactionRule>()

  async function confirmDelete(rule: TransactionRule) {
    const confirmed = await confirm({
      title: $i18n.t('rules.confirmDelete.title'),
      message: $i18n.t('rules.confirmDelete.message', { keyword: rule.keyword }),
    })
    if (confirmed) await deleteRule(rule.id)
  }

  return {
    rules,
    refresh,
    status,
    createRule,
    updateRule,
    deleteRule,
    reorder,
    applyToExisting,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    confirmDelete,
  }
})
