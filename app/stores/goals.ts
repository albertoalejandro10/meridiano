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

  const toast = useToast()
  const { confirm } = useConfirm()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Create/update rethrow so the calling modal can stay open on failure.
  // Goals are leaf data (nothing derives from them), so creates only refresh
  // the list; updates also refresh the goal's detail key when it's loaded.
  async function createGoal(input: GoalInput) {
    try {
      await $fetch('/api/v1/goals', { method: 'POST', body: input })
      await refresh()
      toast.add({ title: $i18n.t('goals.toasts.created'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.createFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  async function updateGoal(id: string, input: Partial<GoalInput>) {
    try {
      await $fetch(`/api/v1/goals/${id}`, { method: 'PATCH', body: input })
      // The detail key is a no-op when that page isn't loaded.
      await refreshNuxtData(['goals', `goal-${id}`])
      toast.add({ title: $i18n.t('goals.toasts.updated'), color: 'success' })
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.updateFailed'), description: err.data?.statusMessage, color: 'error' })
      throw e
    }
  }

  // No rethrow: the boolean tells callers whether to navigate away afterwards.
  async function deleteGoal(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/v1/goals/${id}`, { method: 'DELETE' })
      await refresh()
      // Never refetch a deleted goal — drop its cached detail payload so
      // back-navigation to its URL doesn't serve the corpse.
      clearNuxtData(`goal-${id}`)
      toast.add({ title: $i18n.t('goals.toasts.deleted'), color: 'success' })
      return true
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string } }
      toast.add({ title: $i18n.t('common.toasts.deleteFailed'), description: err.data?.statusMessage, color: 'error' })
      return false
    }
  }

  // --- Goal modal (create/edit) ---
  const modalOpen = ref(false)
  const editing = ref<GoalModalGoal | undefined>()

  function openCreate() {
    editing.value = undefined
    modalOpen.value = true
  }

  function openEdit(goal: GoalModalGoal) {
    editing.value = goal
    modalOpen.value = true
  }

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
