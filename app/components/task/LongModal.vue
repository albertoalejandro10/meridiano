<script setup lang="ts">
import { longTaskSchema, taskPriorities, type LongTaskInput } from '~~/shared/schemas'

const { t } = useI18n()

const tasksStore = useTasksStore()
// `editingLongTask` doubles as the mode switch: set → edit, unset → create.
const { longTaskModalOpen: open, editingLongTask: longTask } = storeToRefs(tasksStore)
const { createLongTask, updateLongTask } = tasksStore

const { data: categories } = useTaskCategories()

const state = reactive({
  title: '',
  notes: '',
  priority: 'MEDIUM' as LongTaskInput['priority'],
  categoryId: null as string | null,
  targetDate: undefined as string | undefined,
  done: false,
})

const priorityItems = computed(() =>
  taskPriorities.map(p => ({ label: t(taskPriorityMeta[p].labelKey), value: p })),
)

const categoryItems = computed(() => [
  { label: t('tasks.modal.noCategory'), value: null },
  ...(categories.value ?? []).map(c => ({ label: c.name, value: c.id, icon: c.icon ?? undefined })),
])

const { saving, submit } = useModalForm(open, () => {
  state.title = longTask.value?.title ?? ''
  state.notes = longTask.value?.notes ?? ''
  state.priority = (longTask.value?.priority as LongTaskInput['priority']) ?? 'MEDIUM'
  state.categoryId = longTask.value?.categoryId ?? null
  state.targetDate = longTask.value?.targetDate ?? undefined
  state.done = longTask.value?.done ?? false
})

const onSubmit = () => submit(() => {
  const input = {
    title: state.title,
    notes: state.notes.trim() ? state.notes : null,
    priority: state.priority,
    categoryId: state.categoryId,
    targetDate: state.targetDate ? new Date(state.targetDate) : null,
    done: state.done,
  }
  return longTask.value ? updateLongTask(longTask.value.id, input) : createLongTask(input)
})
</script>

<template>
  <UModal v-model:open="open" :title="longTask ? $t('tasks.long.modal.editTitle') : $t('tasks.long.modal.newTitle')" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <UForm :schema="longTaskSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('tasks.modal.taskTitle')" name="title" required>
          <UInput v-model="state.title" :placeholder="$t('tasks.long.modal.titlePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('tasks.modal.notes')" name="notes" :hint="$t('common.optional')">
          <UTextarea v-model="state.notes" :rows="3" autoresize :maxrows="6" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('tasks.modal.priority')" name="priority">
            <USelect v-model="state.priority" :items="priorityItems" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="$t('tasks.long.modal.targetDate')" name="targetDate" :hint="$t('common.optional')">
            <UInput v-model="state.targetDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('tasks.modal.category')" name="categoryId">
          <USelectMenu v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" :placeholder="$t('tasks.modal.noCategory')" />
        </UFormField>

        <ModalActions :is-edit="!!longTask" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
