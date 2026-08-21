import type { BudgetInput } from '~~/shared/schemas'

// Budget rows as served by /api/v1/budgets (numeric columns are strings).
export interface Budget {
  id: string
  categoryId: string
  currency: string
  amount: string
  category: { id: string, name: string, slug: string | null, icon: string | null, type: string | null }
}

export interface BudgetIncome {
  currency: string
  amount: string
}

// Structural shape the modal edits — create prefills carry no id.
export interface BudgetModalBudget {
  id?: string
  categoryId?: string
  currency?: string
  amount?: string | number
}

export const useBudgetsStore = defineStore('budgets', () => {
  const { data, refresh, status } = useFetch('/api/v1/budgets', {
    key: 'budgets',
    default: () => ({ budgets: [] as Budget[], incomes: [] as BudgetIncome[] }),
  })

  const budgets = computed(() => data.value.budgets)
  const incomes = computed(() => data.value.incomes)

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup.
  const { $i18n } = useNuxtApp()

  // Create/update rethrow so the calling modal can stay open on failure.
  // Budgets are leaf data (nothing derives from them) — only this key refreshes.
  const createBudget = (input: BudgetInput) => run({
    action: () => $fetch('/api/v1/budgets', { method: 'POST', body: input }),
    refresh,
    success: 'budgets.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateBudget = (id: string, input: Partial<BudgetInput>) => run({
    action: () => $fetch(`/api/v1/budgets/${id}`, { method: 'PATCH', body: input }),
    refresh,
    success: 'budgets.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  const deleteBudget = (id: string) => run({
    action: () => $fetch(`/api/v1/budgets/${id}`, { method: 'DELETE' }),
    refresh,
    success: 'budgets.toasts.deleted',
    failure: 'delete',
  })

  // Expected monthly income for one currency (envelope mode); null clears it.
  const setIncome = (currency: string, amount: number | null) => run({
    action: () => $fetch('/api/v1/budgets/income', { method: 'PUT', body: { currency, amount } }),
    refresh,
    success: 'budgets.toasts.incomeSaved',
    failure: 'save',
    rethrow: true,
  })

  // --- Budget modal (create/edit) ---
  // The prefill lets "budget this category" shortcuts open the form ready to save.
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<
    BudgetModalBudget,
    Pick<BudgetModalBudget, 'categoryId' | 'currency'>
  >()

  async function confirmDelete(budget: Budget) {
    const confirmed = await confirm({
      title: $i18n.t('budgets.confirmDelete.title'),
      message: $i18n.t('budgets.confirmDelete.message', { name: categoryLabel(budget.category, $i18n.t) }),
    })
    if (confirmed) await deleteBudget(budget.id)
  }

  return {
    budgets,
    incomes,
    refresh,
    status,
    createBudget,
    updateBudget,
    deleteBudget,
    setIncome,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    confirmDelete,
  }
})
