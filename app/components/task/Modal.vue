<script setup lang="ts">
import { endOfMonth } from 'date-fns'
import { taskSchema, taskPriorities, type TaskInput } from '~~/shared/schemas'

const { t } = useI18n()

const tasksStore = useTasksStore()
// `editing` doubles as the mode switch: set → edit that task, unset → create.
const { modalOpen: open, editing: task, viewMonth } = storeToRefs(tasksStore)
const { createTask, updateTask } = tasksStore

const { data: categories } = useTaskCategories()
const { data: longTasks } = useLongTasks()

const state = reactive({
  title: '',
  notes: '',
  priority: 'MEDIUM' as TaskInput['priority'],
  categoryId: null as string | null,
  longTaskId: null as string | null,
  month: viewMonth.value,
  dueDate: undefined as string | undefined,
  done: false,
})

const priorityItems = computed(() =>
  taskPriorities.map(p => ({ label: t(taskPriorityMeta[p].labelKey), value: p })),
)

const categoryItems = computed(() => [
  { label: t('tasks.modal.noCategory'), value: null },
  ...(categories.value ?? []).map(c => ({ label: c.name, value: c.id, icon: c.icon ?? undefined })),
])

// Link targets: pending long tasks, plus the currently linked one even when
// it's already done (so editing an old task doesn't silently drop the link).
const longTaskItems = computed(() => [
  { label: t('tasks.modal.noLongTask'), value: null },
  ...(longTasks.value ?? [])
    .filter(lt => !lt.done || lt.id === state.longTaskId)
    .map(lt => ({ label: lt.title, value: lt.id })),
])

// The due day must fall inside the task's month.
const dueMin = computed(() => `${state.month}-01`)
const dueMax = computed(() => toISODate(endOfMonth(parseDate(`${state.month}-01`))))

const { saving, submit } = useModalForm(open, () => {
  state.title = task.value?.title ?? ''
  state.notes = task.value?.notes ?? ''
  state.priority = (task.value?.priority as TaskInput['priority']) ?? 'MEDIUM'
  state.categoryId = task.value?.categoryId ?? null
  state.longTaskId = task.value?.longTaskId ?? null
  state.month = task.value?.month ?? viewMonth.value
  state.dueDate = task.value?.dueDate ?? undefined
  state.done = task.value?.done ?? false
})

const onSubmit = () => submit(() => {
  const input = {
    title: state.title,
    notes: state.notes.trim() ? state.notes : null,
    priority: state.priority,
    categoryId: state.categoryId,
    longTaskId: state.longTaskId,
    month: state.month,
    dueDate: state.dueDate ? new Date(state.dueDate) : null,
    done: state.done,
  }
  return task.value ? updateTask(task.value.id, input) : createTask(input)
})
</script>

<template>
  <UModal v-model:open="open" :title="task ? $t('tasks.modal.editTitle') : $t('tasks.modal.newTitle')" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <UForm :schema="taskSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('tasks.modal.taskTitle')" name="title" required>
          <UInput v-model="state.title" :placeholder="$t('tasks.modal.titlePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('tasks.modal.notes')" name="notes" :hint="$t('common.optional')">
          <UTextarea v-model="state.notes" :rows="3" autoresize :maxrows="6" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('tasks.modal.priority')" name="priority">
            <USelect v-model="state.priority" :items="priorityItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="$t('tasks.modal.dueDate')" name="dueDate" :hint="$t('common.optional')">
            <UInput v-model="state.dueDate" type="date" :min="dueMin" :max="dueMax" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('tasks.modal.category')" name="categoryId">
          <USelectMenu v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" :placeholder="$t('tasks.modal.noCategory')" />
          <template #help>
            <UButton
              :label="$t('tasks.modal.manageCategories')"
              variant="link"
              size="xs"
              :padded="false"
              @click="tasksStore.categoriesOpen = true"
            />
          </template>
        </UFormField>

        <UFormField
          v-if="longTaskItems.length > 1"
          :label="$t('tasks.modal.longTask')"
          name="longTaskId"
          :help="$t('tasks.modal.longTaskHelp')"
        >
          <USelectMenu v-model="state.longTaskId" :items="longTaskItems" value-key="value" class="w-full" :placeholder="$t('tasks.modal.noLongTask')" />
        </UFormField>

        <ModalActions :is-edit="!!task" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
