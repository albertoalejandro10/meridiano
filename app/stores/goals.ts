import type { GoalInput } from '~~/shared/schemas'

// Structural goal shape the modal edits — satisfied by both list items and the
// detail payload (`/api/v1/goals` and `/api/v1/goals/:id`).
export interface GoalModalGoal {
  id: string
  name: string
  targetAmount: string | number
  currency: string
  startDate: string | Date
  targetDate?: string | Date | null
  icon?: string | null
  color?: string | null
  linkedAccounts?: { id: string }[]
}

export const useGoalsStore = defineStore('goals', () => {
  const { data: goals, refresh, status } = useFetch('/api/v1/goals', {
    key: 'goals',
    default: () => [],
  })

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Create/update rethrow so the calling modal can stay open on failure.
  // Goals are leaf data (nothing derives from them), so creates only refresh
  // the list; updates also refresh the goal's detail key when it's loaded.
  const createGoal = (input: GoalInput) => run({
    action: () => $fetch('/api/v1/goals', { method: 'POST', body: input }),
    refresh,
    success: 'goals.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateGoal = (id: string, input: Partial<GoalInput>) => run({
    action: () => $fetch(`/api/v1/goals/${id}`, { method: 'PATCH', body: input }),
    // The detail key is a no-op when that page isn't loaded.
    refresh: ['goals', `goal-${id}`],
    success: 'goals.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // No rethrow: the boolean tells callers whether to navigate away afterwards.
  async function deleteGoal(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/goals/${id}`, { method: 'DELETE' }),
      refresh,
      success: 'goals.toasts.deleted',
      failure: 'delete',
    })
    if (result === undefined) return false

    // Never refetch a deleted goal — drop its cached detail payload so
    // back-navigation to its URL doesn't serve the corpse.
    clearNuxtData(`goal-${id}`)
    return true
  }

  // --- Goal modal (create/edit) ---
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<GoalModalGoal>()

  async function confirmDelete(goal: { id: string, name: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('goals.confirmDelete.title'),
      message: $i18n.t('goals.confirmDelete.message', { name: goal.name }),
    })
    return confirmed ? await deleteGoal(goal.id) : false
  }

  return {
    goals,
    refresh,
    status,
    createGoal,
    updateGoal,
    deleteGoal,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    confirmDelete,
  }
})
