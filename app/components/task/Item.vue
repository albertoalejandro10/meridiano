<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{ task: TaskView }>()

const { t } = useI18n()
const { formatShortDate, formatMonth } = useLocaleFormat()

const tasksStore = useTasksStore()

const priority = computed(() => taskPriority(props.task.priority))
const overdue = computed(() => isTaskOverdue(props.task))

// Read the cached long-tasks list (fetched by the page) — no extra request.
const { data: longTasks } = useNuxtData<LongTaskView[]>('long-tasks')
const linkedLongTask = computed(() =>
  props.task.longTaskId ? longTasks.value?.find(lt => lt.id === props.task.longTaskId) : undefined,
)

// Rescheduling sits in its own group: the labels name the target month so
// there's no doubt about where the task lands (moving also clears the due date).
const menuItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => tasksStore.openEdit(props.task) }],
  [
    {
      label: t('tasks.moveToMonth', { month: formatMonth(shiftMonthStr(props.task.month, 1)) }),
      icon: 'i-lucide-calendar-arrow-down',
      onSelect: () => tasksStore.moveToMonth(props.task, 1),
    },
    {
      label: t('tasks.moveToMonth', { month: formatMonth(shiftMonthStr(props.task.month, -1)) }),
      icon: 'i-lucide-calendar-arrow-up',
      onSelect: () => tasksStore.moveToMonth(props.task, -1),
    },
  ],
  [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => tasksStore.confirmDelete(props.task) }],
])
</script>

<template>
  <div class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50">
    <UCheckbox
      :model-value="task.done"
      :aria-label="$t('tasks.toggleDone')"
      @update:model-value="tasksStore.toggleDone(task)"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm" :class="task.done ? 'text-muted line-through' : ''">
        {{ task.title }}
      </p>
    </div>

    <UTooltip v-if="linkedLongTask" :text="$t('tasks.linkedTo', { title: linkedLongTask.title })">
      <UIcon name="i-lucide-link" class="size-4 shrink-0 text-muted" />
    </UTooltip>

    <UTooltip v-if="task.notes" :text="task.notes">
      <UIcon name="i-lucide-sticky-note" class="size-4 shrink-0 text-muted" />
    </UTooltip>

    <UBadge
      v-if="task.carriedFromMonth"
      :label="$t('tasks.carriedFrom', { month: formatMonth(task.carriedFromMonth) })"
      color="neutral"
      variant="subtle"
      size="sm"
    />

    <span
      v-if="task.dueDate"
      class="flex shrink-0 items-center gap-1 text-xs tabular-nums"
      :class="overdue ? 'font-medium text-error' : 'text-muted'"
    >
      <UIcon :name="overdue ? 'i-lucide-alarm-clock' : 'i-lucide-calendar'" class="size-3.5" />
      {{ formatShortDate(task.dueDate) }}
    </span>

    <UBadge :label="$t(priority.labelKey)" :color="priority.color" variant="subtle" size="sm" />

    <UDropdownMenu :items="menuItems">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="$t('tasks.taskActions')"
      />
    </UDropdownMenu>
  </div>
</template>
