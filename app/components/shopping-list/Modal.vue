<script setup lang="ts">
import { shoppingListSchema } from '~~/shared/schemas'

const listsStore = useShoppingListsStore()
// `editing` doubles as the mode switch: set → rename that list, unset → create.
const { modalOpen: open, editing: list } = storeToRefs(listsStore)
const { createList, updateList } = listsStore

const state = reactive({ name: '' })

const { saving, submit } = useModalForm(open, () => {
  state.name = list.value?.name ?? ''
})

function onSubmit() {
  const editing = list.value
  return editing
    ? submit(() => updateList(editing.id, { name: state.name }))
    : submit(
        () => createList({ name: state.name }),
        // Straight into fast entry — a new list's whole point is adding items.
        async (created) => {
          if (created) await navigateTo(`/app/shopping-lists/${created.id}`)
        },
      )
}
</script>

<template>
  <UModal v-model:open="open" :title="list ? $t('shoppingLists.modal.editTitle') : $t('shoppingLists.modal.newTitle')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="shoppingListSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('common.name')" name="name" required>
          <UInput v-model="state.name" :placeholder="$t('shoppingLists.modal.namePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <ModalActions :is-edit="!!list" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
