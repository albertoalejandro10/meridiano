<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = route.params.id as string

const { t } = useI18n()
const { formatFullDate } = useLocaleFormat()

const { data: note, error } = useNote(id)
const notesStore = useNotesStore()

useSeoMeta({ title: () => note.value?.title ?? t('notes.title') })

async function onDelete() {
  // Only leave the page when the delete actually succeeded.
  if (note.value && await notesStore.confirmDelete(note.value)) {
    // The editor's unsaved-changes guard would otherwise ask about a draft of
    // the note we just deleted.
    notesStore.skipUnsavedGuard = true
    await navigateTo('/app/notes')
  }
}

// Clicking a tag here filters the list, so it has to be set before we navigate.
async function onTag(tag: string) {
  notesStore.activeTag = tag
  await navigateTo('/app/notes')
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'notes.title', icon: 'i-lucide-notebook-pen', to: '/app/notes' },
  { label: () => note.value?.title },
])
</script>

<template>
  <UDashboardPanel id="note-detail">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div v-if="error" class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('notes.notFound') }}
        </p>
        <UButton to="/app/notes" :label="$t('notes.backToNotes')" />
      </div>

      <div v-else-if="note" class="space-y-6">
        <!-- header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-start gap-3">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon :name="note.pinned ? 'i-lucide-pin' : 'i-lucide-notebook-pen'" class="size-6" />
            </span>
            <div class="min-w-0">
              <h1 class="text-xl font-semibold">
                {{ note.title }}
              </h1>
              <p class="text-sm text-muted">
                {{ $t('notes.updatedAt', { date: formatFullDate(note.updatedAt) }) }}
              </p>
            </div>
          </div>

          <div class="flex shrink-0 gap-1">
            <UButton
              :icon="note.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
              :color="note.pinned ? 'primary' : 'neutral'"
              variant="ghost"
              :aria-label="note.pinned ? $t('notes.unpin') : $t('notes.pin')"
              @click="notesStore.togglePinned(note)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="$t('notes.editDetails')"
              @click="notesStore.openEdit(note)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              :aria-label="$t('common.delete')"
              @click="onDelete"
            />
          </div>
        </div>

        <div v-if="note.tags.length" class="flex flex-wrap gap-1.5">
          <UBadge
            v-for="tag in note.tags"
            :key="tag"
            :label="tag"
            color="neutral"
            variant="subtle"
            class="cursor-pointer"
            @click="onTag(tag)"
          />
        </div>

        <NoteEditor :note="note" />
      </div>
    </template>
  </UDashboardPanel>
</template>
