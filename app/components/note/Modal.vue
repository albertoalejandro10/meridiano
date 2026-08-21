<script setup lang="ts">
import { MAX_NOTE_TAGS, noteSchema } from '~~/shared/schemas'

// A note's *details* — title and tags. The body is edited on the detail page,
// where there's room for the editor and its preview side by side.
const notesStore = useNotesStore()
// `editing` doubles as the mode switch: set → edit that note, unset → create.
const { modalOpen: open, editing: note } = storeToRefs(notesStore)
const { createNote, updateNote } = notesStore

const state = reactive({ title: '', tags: [] as string[] })

const { saving, submit } = useModalForm(open, () => {
  state.title = note.value?.title ?? ''
  // Copied, so editing the chips never mutates the row the modal was opened on.
  state.tags = [...(note.value?.tags ?? [])]
})

function onSubmit() {
  const editing = note.value
  return editing
    ? submit(() => updateNote(editing.id, { title: state.title, tags: state.tags }))
    : submit(
        () => createNote({ title: state.title, tags: state.tags, content: '', pinned: false }),
        // Straight into the editor — a new note exists to be written in.
        async (created) => {
          if (created) await navigateTo(`/app/notes/${created.id}`)
        },
      )
}
</script>

<template>
  <UModal v-model:open="open" :title="note ? $t('notes.modal.editTitle') : $t('notes.modal.newTitle')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="noteSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('notes.fields.title')" name="title" required>
          <UInput v-model="state.title" :placeholder="$t('notes.modal.titlePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('notes.fields.tags')" name="tags" :hint="$t('notes.modal.tagsHint')">
          <UInputTags
            v-model="state.tags"
            :placeholder="$t('notes.modal.tagsPlaceholder')"
            :max="MAX_NOTE_TAGS"
            add-on-blur
            add-on-paste
            class="w-full"
          />
        </UFormField>

        <ModalActions :is-edit="!!note" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
