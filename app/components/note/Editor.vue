<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import { MAX_NOTE_CONTENT } from '~~/shared/schemas'

const props = defineProps<{ note: NoteRow }>()

const { t } = useI18n()
const { confirm } = useConfirm()
const notesStore = useNotesStore()

// A note is usually opened to be read, not rewritten — but an empty one exists
// only to be filled in, so it opens straight in the editor.
const mode = ref<'write' | 'preview'>(props.note.content ? 'preview' : 'write')
const modeItems = computed(() => [
  { label: t('notes.editor.write'), value: 'write', icon: 'i-lucide-pencil' },
  { label: t('notes.editor.preview'), value: 'preview', icon: 'i-lucide-eye' },
])

const draft = ref(props.note.content)
const saving = ref(false)

const dirty = computed(() => draft.value !== props.note.content)

// Re-sync when the server copy changes (the note loaded, or another tab saved),
// but never on top of unsaved edits — that would silently discard them.
watch(() => props.note.content, (content) => {
  if (!dirty.value) draft.value = content
})

async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    await notesStore.saveContent(props.note.id, draft.value)
  }
  catch {
    // The store toasted it; the draft stays for another attempt.
  }
  finally {
    saving.value = false
  }
}

// ⌘S / Ctrl+S while typing — the reflex everyone already has in an editor.
defineShortcuts({
  meta_s: { handler: save, usingInput: true },
})

// Leaving with unsaved edits loses them, so ask first. Covers in-app links
// only; a hard reload or tab close is the browser's own confirmation.
onBeforeRouteLeave(async () => {
  // The note was just deleted — there is nothing left to save it into.
  if (notesStore.skipUnsavedGuard) {
    notesStore.skipUnsavedGuard = false
    return true
  }
  if (!dirty.value) return true
  return await confirm({
    title: t('notes.editor.unsaved.title'),
    message: t('notes.editor.unsaved.message'),
  })
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UTabs
        v-model="mode"
        :items="modeItems"
        :content="false"
        size="sm"
        color="neutral"
      />

      <div class="flex items-center gap-3">
        <span v-if="dirty" class="text-xs text-muted">{{ $t('notes.editor.unsavedChanges') }}</span>
        <UButton
          :label="$t('common.save')"
          icon="i-lucide-save"
          size="sm"
          :loading="saving"
          :disabled="!dirty"
          @click="save"
        />
      </div>
    </div>

    <UTextarea
      v-if="mode === 'write'"
      v-model="draft"
      :rows="18"
      :maxrows="40"
      autoresize
      :maxlength="MAX_NOTE_CONTENT"
      :placeholder="$t('notes.editor.placeholder')"
      class="w-full"
      :ui="{ base: 'font-mono text-sm' }"
    />

    <div v-else class="min-h-40 rounded-lg p-4 ring ring-default bg-elevated/30">
      <NoteContent v-if="draft" :content="draft" />
      <p v-else class="text-sm italic text-dimmed">
        {{ $t('notes.editor.emptyPreview') }}
      </p>
    </div>

    <p v-if="mode === 'write'" class="text-xs text-dimmed">
      {{ $t('notes.editor.hint') }}
    </p>
  </div>
</template>
