<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('notes.title') })

const notesStore = useNotesStore()
const { searchInput, activeTag, filters, hasFilters } = storeToRefs(notesStore)

const { data, status } = useNotes(filters)

const notes = computed(() => data.value.notes)
const tags = computed(() => data.value.tags)

// "No notes yet" and "nothing matched" are different dead ends: one wants a
// create button, the other wants the filters cleared. Only the tag vocabulary
// distinguishes them — it's computed over every note, filters or not.
const noNotesAtAll = computed(() => !notes.value.length && !hasFilters.value)

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'notes.title', icon: 'i-lucide-notebook-pen', to: '/app/notes' },
])
</script>

<template>
  <UDashboardPanel id="notes">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('notes.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('notes.subtitle') }}
          </p>
        </div>
        <UButton :label="$t('notes.new')" icon="i-lucide-plus" @click="notesStore.openCreate()" />
      </div>

      <!-- filters -->
      <div v-if="!noNotesAtAll" class="mb-6 space-y-3">
        <UInput
          v-model="searchInput"
          icon="i-lucide-search"
          :placeholder="$t('notes.searchPlaceholder')"
          class="w-full sm:max-w-sm"
          :loading="status === 'pending'"
        >
          <template v-if="searchInput" #trailing>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="link"
              size="xs"
              :aria-label="$t('notes.clearSearch')"
              @click="searchInput = ''"
            />
          </template>
        </UInput>

        <div v-if="tags.length" class="flex flex-wrap items-center gap-1.5">
          <UButton
            v-for="tag in tags"
            :key="tag.name"
            :label="`${tag.name} (${tag.count})`"
            :color="activeTag === tag.name ? 'primary' : 'neutral'"
            :variant="activeTag === tag.name ? 'solid' : 'subtle'"
            size="xs"
            @click="notesStore.toggleTag(tag.name)"
          />
        </div>
      </div>

      <UPageGrid v-if="notes.length" class="lg:grid-cols-3">
        <NoteCard
          v-for="note in notes"
          :key="note.id"
          :note="note"
          @edit="notesStore.openEdit(note)"
          @delete="notesStore.confirmDelete(note)"
          @pin="notesStore.togglePinned(note)"
          @tag="notesStore.toggleTag($event)"
        />
      </UPageGrid>

      <div v-else-if="noNotesAtAll" class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-notebook-pen" class="size-10 text-muted" />
        <div>
          <p class="text-muted">
            {{ $t('notes.empty') }}
          </p>
          <p class="mt-1 text-sm text-dimmed">
            {{ $t('notes.emptyHint') }}
          </p>
        </div>
        <UButton :label="$t('notes.new')" icon="i-lucide-plus" @click="notesStore.openCreate()" />
      </div>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('notes.noResults') }}
        </p>
        <UButton :label="$t('notes.clearFilters')" color="neutral" variant="subtle" @click="notesStore.clearFilters()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
