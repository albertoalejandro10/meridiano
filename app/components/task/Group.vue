<script setup lang="ts">
const props = defineProps<{
  /** null = the trailing "Uncategorized" pseudo-group */
  category: TaskCategoryView | null
  tasks: TaskView[]
}>()

const accent = computed(() => goalAccent(props.category?.color))
const doneCount = computed(() => props.tasks.filter(t => t.done).length)
</script>

<template>
  <UCollapsible :default-open="true" :ui="{ content: 'pt-1' }">
    <template #default="{ open }">
      <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-elevated/50">
        <span class="flex size-6 items-center justify-center rounded-md" :class="category ? accent.soft : 'bg-elevated'">
          <UIcon
            :name="category?.icon ?? 'i-lucide-inbox'"
            class="size-3.5"
            :class="category ? accent.text : 'text-muted'"
          />
        </span>
        <span class="text-sm font-medium">
          {{ category?.name ?? $t('tasks.uncategorized') }}
        </span>
        <span class="text-xs tabular-nums text-muted">{{ doneCount }}/{{ tasks.length }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="ml-auto size-4 text-muted transition-transform"
          :class="open ? '' : '-rotate-90'"
        />
      </button>
    </template>

    <template #content>
      <div class="space-y-0.5 pl-4">
        <TaskItem v-for="task in tasks" :key="task.id" :task="task" />
      </div>
    </template>
  </UCollapsible>
</template>
