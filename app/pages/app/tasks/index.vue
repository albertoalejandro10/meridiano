<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMonth } = useLocaleFormat()

useSeoMeta({ title: () => t('tasks.title') })

const tasksStore = useTasksStore()
const { viewMonth, isCurrentMonth } = storeToRefs(tasksStore)

const { data } = useTasks(viewMonth)
const { data: categories } = useTaskCategories()
const { data: longTasks } = useLongTasks()

const doneCount = computed(() => data.value.tasks.filter(task => task.done).length)
const totalCount = computed(() => data.value.tasks.length)
const pct = computed(() => percentOf(doneCount.value, totalCount.value))

// Category groups in name order (the categories fetch is already sorted),
// Uncategorized last; within a group pending tasks sort by priority then due
// day, with done tasks sunk to the bottom. Pure client-side so a checkbox
// toggle re-sorts instantly.
const groups = computed(() => {
  const byCategory = new Map<string | null, TaskView[]>()
  for (const task of data.value.tasks) {
    const key = task.categoryId
    const list = byCategory.get(key) ?? []
    list.push(task)
    byCategory.set(key, list)
  }

  const sortTasks = (tasks: TaskView[]) =>
    [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const rank = taskPriority(a.priority).rank - taskPriority(b.priority).rank
      if (rank !== 0) return rank
      return (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1
    })

  const result: { category: TaskCategoryView | null, tasks: TaskView[] }[] = (categories.value ?? [])
    .filter(category => byCategory.has(category.id))
    .map(category => ({ category, tasks: sortTasks(byCategory.get(category.id)!) }))

  const uncategorized = byCategory.get(null)
  if (uncategorized?.length) result.push({ category: null, tasks: sortTasks(uncategorized) })

  return result
})

// Long-term commitments: not month-scoped, so the list ignores month
// navigation. Pending first (priority, then target date), done sunk.
const sortedLongTasks = computed(() =>
  [...(longTasks.value ?? [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const rank = taskPriority(a.priority).rank - taskPriority(b.priority).rank
    if (rank !== 0) return rank
    return (a.targetDate ?? '9999') < (b.targetDate ?? '9999') ? -1 : 1
  }),
)

const categoryById = computed(() =>
  new Map((categories.value ?? []).map(category => [category.id, category])),
)

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'tasks.title', icon: 'i-lucide-list-todo', to: '/app/tasks' },
])
</script>

<template>
  <UDashboardPanel id="tasks">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('tasks.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('tasks.subtitle') }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            :label="$t('tasks.categories.manageButton')"
            icon="i-lucide-tags"
            color="neutral"
            variant="ghost"
            @click="tasksStore.categoriesOpen = true"
          />
          <UButton :label="$t('tasks.new')" icon="i-lucide-plus" @click="tasksStore.openCreate()" />
        </div>
      </div>

      <!-- month navigator -->
      <div class="mb-6 flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          :aria-label="$t('tasks.prevMonth')"
          @click="tasksStore.prevMonth()"
        />
        <span class="min-w-28 text-center font-medium capitalize">{{ formatMonth(viewMonth) }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          :aria-label="$t('tasks.nextMonth')"
          @click="tasksStore.nextMonth()"
        />
        <UButton
          v-if="!isCurrentMonth"
          :label="$t('tasks.currentMonth')"
          color="neutral"
          variant="soft"
          size="sm"
          @click="tasksStore.goToCurrentMonth()"
        />
      </div>

      <!-- carry-over banner: only ever prompts on the current month -->
      <UAlert
        v-if="isCurrentMonth && data.previousPending.length"
        icon="i-lucide-history"
        color="primary"
        variant="subtle"
        :title="$t('tasks.carryOver.banner', { count: data.previousPending.length }, data.previousPending.length)"
        :actions="[{ label: $t('tasks.carryOver.bannerAction'), onClick: () => { tasksStore.carryOverOpen = true } }]"
        class="mb-6"
      />

      <!-- month progress -->
      <UPageCard v-if="totalCount" variant="subtle" class="mb-6">
        <div class="space-y-2">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-muted">{{ $t('tasks.progress', { done: doneCount, total: totalCount }) }}</span>
            <span class="text-xs font-medium tabular-nums">{{ pct }}%</span>
          </div>
          <UProgress :model-value="pct" />
        </div>
      </UPageCard>

      <div v-if="totalCount" class="space-y-4">
        <TaskGroup
          v-for="group in groups"
          :key="group.category?.id ?? 'uncategorized'"
          :category="group.category"
          :tasks="group.tasks"
        />
      </div>

      <div v-else class="flex flex-col items-center gap-4 py-16 text-center">
        <UIcon name="i-lucide-list-todo" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('tasks.empty') }}
        </p>
        <UButton :label="$t('tasks.new')" icon="i-lucide-plus" @click="tasksStore.openCreate()" />
      </div>

      <!-- long-term tasks: GTD projects that outlive a month; unaffected by month navigation -->
      <div class="mt-10 border-t border-default pt-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="font-semibold">
              {{ $t('tasks.long.title') }}
            </h2>
            <p class="text-sm text-muted">
              {{ $t('tasks.long.subtitle') }}
            </p>
          </div>
          <UButton
            :label="$t('tasks.long.new')"
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            @click="tasksStore.openCreateLongTask()"
          />
        </div>

        <div v-if="sortedLongTasks.length" class="space-y-0.5">
          <TaskLongItem
            v-for="longTask in sortedLongTasks"
            :key="longTask.id"
            :long-task="longTask"
            :category="longTask.categoryId ? categoryById.get(longTask.categoryId) ?? null : null"
          />
        </div>
        <p v-else class="py-6 text-center text-sm text-muted">
          {{ $t('tasks.long.empty') }}
        </p>
      </div>

      <!-- mounted here (not the layout): it needs this page's previousPending data -->
      <TaskCarryOverModal :pending="data.previousPending" />
    </template>
  </UDashboardPanel>
</template>
