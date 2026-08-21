<script setup lang="ts">
import { taskCategorySchema, taskCategoryIcons, goalColors, type TaskCategoryInput } from '~~/shared/schemas'

const tasksStore = useTasksStore()
const { categoriesOpen: open } = storeToRefs(tasksStore)
const { createCategory, updateCategory, confirmDeleteCategory } = tasksStore

const { data: categories } = useTaskCategories()

// One inline form for both modes: `editing` set → edit that category, unset → create.
const formOpen = ref(false)
const editing = ref<TaskCategoryView | undefined>()

const state = reactive({
  name: '',
  icon: 'i-lucide-folder' as TaskCategoryInput['icon'],
  color: 'sky' as TaskCategoryInput['color'],
})

function openCreateForm() {
  editing.value = undefined
  state.name = ''
  state.icon = 'i-lucide-folder'
  state.color = 'sky'
  formOpen.value = true
}

function openEditForm(category: TaskCategoryView) {
  editing.value = category
  state.name = category.name
  state.icon = (category.icon as TaskCategoryInput['icon']) ?? 'i-lucide-folder'
  state.color = (category.color as TaskCategoryInput['color']) ?? 'sky'
  formOpen.value = true
}

watch(open, (isOpen) => {
  if (!isOpen) formOpen.value = false
})

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    if (editing.value) await updateCategory(editing.value.id, { ...state })
    else await createCategory({ ...state })
    formOpen.value = false
  }
  catch {
    // toast handled in the store; keep the form open for another attempt
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="$t('tasks.categories.title')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <div v-if="categories?.length" class="space-y-1">
          <div
            v-for="category in categories"
            :key="category.id"
            class="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-elevated/50"
          >
            <span class="flex size-7 items-center justify-center rounded-md" :class="goalAccent(category.color).soft">
              <UIcon :name="category.icon ?? 'i-lucide-folder'" class="size-4" :class="goalAccent(category.color).text" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm">{{ category.name }}</span>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="$t('common.edit')"
              @click="openEditForm(category)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="$t('common.delete')"
              @click="confirmDeleteCategory(category)"
            />
          </div>
        </div>
        <p v-else-if="!formOpen" class="py-2 text-center text-sm text-muted">
          {{ $t('tasks.categories.empty') }}
        </p>

        <UForm v-if="formOpen" :schema="taskCategorySchema" :state="state" class="space-y-4 border-t border-default pt-4" @submit="onSubmit">
          <UFormField :label="$t('common.name')" name="name" required>
            <UInput v-model="state.name" :placeholder="$t('tasks.categories.namePlaceholder')" class="w-full" autofocus />
          </UFormField>

          <UFormField :label="$t('tasks.categories.icon')" name="icon">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="icon in taskCategoryIcons"
                :key="icon"
                type="button"
                class="flex size-8 items-center justify-center rounded-md transition hover:scale-110"
                :class="state.icon === icon ? goalAccent(state.color).soft : 'bg-elevated'"
                :aria-label="icon"
                @click="state.icon = icon"
              >
                <UIcon :name="icon" class="size-4" :class="state.icon === icon ? goalAccent(state.color).text : 'text-muted'" />
              </button>
            </div>
          </UFormField>

          <UFormField :label="$t('tasks.categories.color')" name="color">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in goalColors"
                :key="c"
                type="button"
                class="flex size-7 items-center justify-center rounded-full transition hover:scale-110"
                :class="goalColorClasses[c].solid"
                :aria-label="c"
                @click="state.color = c"
              >
                <UIcon v-if="state.color === c" name="i-lucide-check" class="size-4 text-white" />
              </button>
            </div>
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="formOpen = false" />
            <UButton type="submit" :label="editing ? $t('common.save') : $t('common.create')" :loading="saving" />
          </div>
        </UForm>

        <UButton
          v-else
          :label="$t('tasks.categories.new')"
          icon="i-lucide-plus"
          variant="soft"
          block
          @click="openCreateForm()"
        />
      </div>
    </template>
  </UModal>
</template>
