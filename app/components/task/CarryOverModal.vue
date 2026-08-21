<script setup lang="ts">
// Pending-task shape from the month GET's `previousPending` array.
export interface TaskPendingItem {
  id: string
  title: string
  month: string
  priority: string
  categoryId: string | null
}

const props = defineProps<{ pending: TaskPendingItem[] }>()

const { formatMonth } = useLocaleFormat()

const tasksStore = useTasksStore()
const { carryOverOpen: open } = storeToRefs(tasksStore)

const selected = ref<Set<string>>(new Set())

// Everything pre-checked on open — the common case is "bring it all forward".
watch(open, (isOpen) => {
  if (isOpen) selected.value = new Set(props.pending.map(t => t.id))
})

const allSelected = computed(() => selected.value.size === props.pending.length)

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(props.pending.map(t => t.id))
}

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

// Grouped by source month (already server-ordered oldest first).
const groups = computed(() => {
  const map = new Map<string, TaskPendingItem[]>()
  for (const task of props.pending) {
    const list = map.get(task.month) ?? []
    list.push(task)
    map.set(task.month, list)
  }
  return [...map].map(([month, tasks]) => ({ month, tasks }))
})

const saving = ref(false)

async function onConfirm() {
  const ids = [...selected.value]
  const sourceMonths = [...new Set(props.pending.filter(t => selected.value.has(t.id)).map(t => t.month))]
  saving.value = true
  try {
    await tasksStore.carryOver(ids, sourceMonths)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="$t('tasks.carryOver.title')" :description="$t('tasks.carryOver.description')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <div v-for="group in groups" :key="group.month" class="space-y-1">
          <p class="px-2 text-xs font-medium uppercase tracking-wide text-muted">
            {{ formatMonth(group.month) }}
          </p>
          <label
            v-for="task in group.tasks"
            :key="task.id"
            class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50"
          >
            <UCheckbox :model-value="selected.has(task.id)" @update:model-value="toggle(task.id)" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ task.title }}</span>
            <UBadge :label="$t(taskPriority(task.priority).labelKey)" :color="taskPriority(task.priority).color" variant="subtle" size="sm" />
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton
          :label="allSelected ? $t('tasks.carryOver.selectNone') : $t('tasks.carryOver.selectAll')"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleAll()"
        />
        <div class="flex gap-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton
            :label="$t('tasks.carryOver.action', { count: selected.size }, selected.size)"
            :disabled="selected.size === 0"
            :loading="saving"
            @click="onConfirm()"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
