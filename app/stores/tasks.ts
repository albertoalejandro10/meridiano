import { format } from 'date-fns'
import type { LongTaskInput, TaskCategoryInput, TaskInput } from '~~/shared/schemas'

// Monthly tasks: month navigation + all mutations + modal state. The month
// lives here (not on the page) because the layout-mounted modals need it —
// TaskModal defaults new tasks into it, TaskCarryOverModal targets it.
export const useTasksStore = defineStore('tasks', () => {
  const currentMonth = () => format(new Date(), 'yyyy-MM')

  const viewMonth = ref(currentMonth())
  const isCurrentMonth = computed(() => viewMonth.value === currentMonth())

  function shiftMonth(delta: number) {
    viewMonth.value = shiftMonthStr(viewMonth.value, delta)
  }
  const prevMonth = () => shiftMonth(-1)
  const nextMonth = () => shiftMonth(1)
  const goToCurrentMonth = () => { viewMonth.value = currentMonth() }

  const toast = useToast()
  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  const monthKey = () => `tasks:${viewMonth.value}`

  // Tasks are leaf data (nothing financial derives from them), so mutations
  // refresh only the affected keys — never the bare refreshNuxtData(). The
  // 'long-tasks' key rides along because monthly done-states feed the derived
  // progress of linked long tasks (no-op when that list isn't loaded).
  const monthKeys = () => [monthKey(), 'long-tasks']

  // Create/update rethrow so the calling modal can stay open on failure.
  const createTask = (input: TaskInput) => run({
    action: () => $fetch('/api/v1/tasks', { method: 'POST', body: input }),
    refresh: [`tasks:${input.month}`, 'long-tasks'],
    success: 'tasks.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateTask = (id: string, input: Partial<TaskInput>) => run({
    action: () => $fetch(`/api/v1/tasks/${id}`, { method: 'PATCH', body: input }),
    refresh: monthKeys(),
    success: 'tasks.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // Checking off happens many times per visit — successes stay silent (a toast
  // per tick is noise), errors still surface.
  const toggleDone = (task: TaskView) => run({
    action: () => $fetch(`/api/v1/tasks/${task.id}`, { method: 'PATCH', body: { done: !task.done } }),
    refresh: monthKeys(),
    failure: 'update',
  })

  async function deleteTask(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/tasks/${id}`, { method: 'DELETE' }),
      refresh: monthKeys(),
      success: 'tasks.toasts.deleted',
      failure: 'delete',
    })
    return result !== undefined
  }

  async function confirmDelete(task: { id: string, title: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('tasks.confirmDelete.title'),
      message: $i18n.t('tasks.confirmDelete.message', { title: task.title }),
    })
    return confirmed ? await deleteTask(task.id) : false
  }

  // Reschedule one task to an adjacent month from its row menu (the carry-over
  // modal only does bulk moves from earlier months into the viewed one, and
  // never forward). The old due day may not exist in the target month, so the
  // due date is cleared — same rule as carry-over. Both month keys refresh;
  // the target one is a no-op when that month isn't loaded.
  async function moveToMonth(task: TaskView, delta: number) {
    const toMonth = shiftMonthStr(task.month, delta)
    await run({
      action: () => $fetch(`/api/v1/tasks/${task.id}`, { method: 'PATCH', body: { month: toMonth, dueDate: null } }),
      refresh: [`tasks:${task.month}`, `tasks:${toMonth}`, 'long-tasks'],
      success: delta > 0 ? 'tasks.toasts.movedNext' : 'tasks.toasts.movedPrev',
      failure: 'update',
    })
  }

  // Move selected pending tasks from earlier months into the viewed month.
  // Source-month keys refresh only if cached (no-op otherwise), so a stale
  // prior-month view can't resurrect moved tasks. The count in the toast comes
  // from the response, so this one reports success itself.
  async function carryOver(ids: string[], sourceMonths: string[]) {
    const moved = await run({
      action: () => $fetch('/api/v1/tasks/carry-over', {
        method: 'POST',
        body: { ids, toMonth: viewMonth.value },
      }),
      refresh: [monthKey(), ...sourceMonths.map(m => `tasks:${m}`)],
      failure: 'update',
    })
    if (!moved) return

    toast.add({ title: $i18n.t('tasks.carryOver.toast', { count: moved.length }, moved.length), color: 'success' })
    carryOverOpen.value = false
  }

  // --- Long-task mutations (GTD projects that outlive a month) ---
  const createLongTask = (input: LongTaskInput) => run({
    action: () => $fetch('/api/v1/long-tasks', { method: 'POST', body: input }),
    refresh: ['long-tasks'],
    success: 'tasks.long.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateLongTask = (id: string, input: Partial<LongTaskInput>) => run({
    action: () => $fetch(`/api/v1/long-tasks/${id}`, { method: 'PATCH', body: input }),
    refresh: ['long-tasks'],
    success: 'tasks.long.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  const toggleLongTaskDone = (longTask: LongTaskView) => run({
    action: () => $fetch(`/api/v1/long-tasks/${longTask.id}`, { method: 'PATCH', body: { done: !longTask.done } }),
    refresh: ['long-tasks'],
    failure: 'update',
  })

  async function confirmDeleteLongTask(longTask: { id: string, title: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('tasks.long.confirmDelete.title'),
      message: $i18n.t('tasks.long.confirmDelete.message', { title: longTask.title }),
    })
    if (!confirmed) return false

    const result = await run({
      action: () => $fetch(`/api/v1/long-tasks/${longTask.id}`, { method: 'DELETE' }),
      // Deleting unlinks its monthly tasks, so the month view refreshes too.
      refresh: ['long-tasks', monthKey()],
      success: 'tasks.long.toasts.deleted',
      failure: 'delete',
    })
    return result !== undefined
  }

  // --- Category mutations (same section, same surface) ---
  // A deleted category nulls categoryId on its tasks and long tasks, so both
  // lists refresh alongside the category list.
  const categoryKeys = () => ['task-categories', monthKey(), 'long-tasks']

  const createCategory = (input: TaskCategoryInput) => run({
    action: () => $fetch('/api/v1/task-categories', { method: 'POST', body: input }),
    refresh: categoryKeys(),
    success: 'tasks.categories.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateCategory = (id: string, input: Partial<TaskCategoryInput>) => run({
    action: () => $fetch(`/api/v1/task-categories/${id}`, { method: 'PATCH', body: input }),
    refresh: categoryKeys(),
    success: 'tasks.categories.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  async function confirmDeleteCategory(category: { id: string, name: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('tasks.categories.confirmDelete.title'),
      message: $i18n.t('tasks.categories.confirmDelete.message', { name: category.name }),
    })
    if (!confirmed) return false

    const result = await run({
      action: () => $fetch(`/api/v1/task-categories/${category.id}`, { method: 'DELETE' }),
      refresh: categoryKeys(),
      success: 'tasks.categories.toasts.deleted',
      failure: 'delete',
    })
    return result !== undefined
  }

  // --- Modal state (modals are mounted once in the dashboard layout) ---
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<TaskView>()

  const {
    modalOpen: longTaskModalOpen,
    editing: editingLongTask,
    openCreate: openCreateLongTask,
    openEdit: openEditLongTask,
  } = useEditorModal<LongTaskView>()

  const carryOverOpen = ref(false)
  const categoriesOpen = ref(false)

  return {
    viewMonth,
    isCurrentMonth,
    prevMonth,
    nextMonth,
    goToCurrentMonth,
    createTask,
    updateTask,
    toggleDone,
    deleteTask,
    confirmDelete,
    moveToMonth,
    carryOver,
    createLongTask,
    updateLongTask,
    toggleLongTaskDone,
    confirmDeleteLongTask,
    createCategory,
    updateCategory,
    confirmDeleteCategory,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    longTaskModalOpen,
    editingLongTask,
    openCreateLongTask,
    openEditLongTask,
    carryOverOpen,
    categoriesOpen,
  }
})
