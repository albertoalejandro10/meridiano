// Month-keyed task list. Fetch-only: mutations live on the tasks store
// (useTasksStore), which refreshes the affected month keys by name.
export function useTasks(month: Ref<string>) {
  // The key must track the month — different months are different queries and
  // must never share one cache entry.
  return useFetch('/api/v1/tasks', {
    key: computed(() => `tasks:${month.value}`),
    query: computed(() => ({ month: month.value })),
    default: () => ({ month: '', tasks: [], previousPending: [] }),
  })
}

export function useTaskCategories() {
  return useFetch('/api/v1/task-categories', {
    key: 'task-categories',
    default: () => [],
  })
}

export function useLongTasks() {
  return useFetch('/api/v1/long-tasks', {
    key: 'long-tasks',
    default: () => [],
  })
}
