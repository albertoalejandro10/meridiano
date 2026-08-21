<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  longTask: LongTaskView
  category: TaskCategoryView | null
}>()

const { t } = useI18n()
const { formatShortDate } = useLocaleFormat()

const tasksStore = useTasksStore()

const priority = computed(() => taskPriority(props.longTask.priority))
const overdue = computed(() => isLongTaskOverdue(props.longTask))
const accent = computed(() => goalAccent(props.category?.color))

const menuItems = computed<DropdownMenuItem[]>(() => [
  { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => tasksStore.openEditLongTask(props.longTask) },
  { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => tasksStore.confirmDeleteLongTask(props.longTask) },
])
</script>

<template>
  <div class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50">
    <UCheckbox
      :model-value="longTask.done"
      :aria-label="$t('tasks.toggleDone')"
      @update:model-value="tasksStore.toggleLongTaskDone(longTask)"
    />

    <span v-if="category" class="flex size-6 shrink-0 items-center justify-center rounded-md" :class="accent.soft">
      <UIcon :name="category.icon ?? 'i-lucide-folder'" class="size-3.5" :class="accent.text" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm" :class="longTask.done ? 'text-muted line-through' : ''">
        {{ longTask.title }}
      </p>
    </div>

    <UTooltip v-if="longTask.notes" :text="longTask.notes">
      <UIcon name="i-lucide-sticky-note" class="size-4 shrink-0 text-muted" />
    </UTooltip>

    <!-- derived progress over linked monthly next actions -->
    <UTooltip v-if="longTask.linkedCount" :text="$t('tasks.long.progressHelp')">
      <span class="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted">
        <UIcon name="i-lucide-link" class="size-3.5" />
        {{ longTask.linkedDoneCount }}/{{ longTask.linkedCount }}
      </span>
    </UTooltip>

    <span
      v-if="longTask.targetDate"
      class="flex shrink-0 items-center gap-1 text-xs tabular-nums"
      :class="overdue ? 'font-medium text-error' : 'text-muted'"
    >
      <UIcon :name="overdue ? 'i-lucide-alarm-clock' : 'i-lucide-flag'" class="size-3.5" />
      {{ formatShortDate(longTask.targetDate) }}
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
