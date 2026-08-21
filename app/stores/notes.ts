import type { NoteInput } from '~~/shared/schemas'
import type { NoteFilters } from '~/composables/useNotes'

// Notes: the list filters plus every mutation and the details-modal state.
// The filters live here (not on the page) because the store has to rebuild the
// active list key to refresh it after a mutation, and because the modal is
// mounted in the dashboard layout, outside the page.
export const useNotesStore = defineStore('notes', () => {
  // What the search box is bound to, and the debounced value that actually
  // reaches the query — a request per keystroke would also mean a cache entry
  // per keystroke, since the key is derived from the filters.
  const searchInput = ref('')
  const search = ref('')
  const activeTag = ref<string | undefined>()

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(searchInput, (value) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { search.value = value.trim() }, 250)
  })

  const filters = computed<NoteFilters>(() => ({
    search: search.value || undefined,
    tag: activeTag.value,
  }))

  /** Clicking the active tag clears the filter — the chips are a toggle. */
  function toggleTag(tag: string) {
    activeTag.value = activeTag.value === tag ? undefined : tag
  }

  function clearFilters() {
    searchInput.value = ''
    search.value = ''
    activeTag.value = undefined
    clearTimeout(searchTimer)
  }

  const hasFilters = computed(() => !!search.value || !!activeTag.value)

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Notes are leaf data (nothing derives from them), so mutations refresh only
  // the list under the current filters plus the note's own detail key — never
  // the bare refreshNuxtData(). The detail key is a no-op when that page isn't
  // loaded, and vice versa.
  const noteKeys = (id?: string) => {
    const keys = [notesKey(filters.value)]
    if (id) keys.push(`note-${id}`)
    return keys
  }

  // Create/update rethrow so the calling modal can stay open on failure.
  const createNote = (input: NoteInput) => run({
    action: () => $fetch('/api/v1/notes', { method: 'POST', body: input }),
    refresh: noteKeys(),
    success: 'notes.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateNote = (id: string, input: Partial<NoteInput>) => run({
    action: () => $fetch(`/api/v1/notes/${id}`, { method: 'PATCH', body: input }),
    refresh: noteKeys(id),
    success: 'notes.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // Saving the body happens on a deliberate Save (or ⌘S), often mid-thought —
  // it reports through the editor's own "saved" state, so no toast on success.
  const saveContent = (id: string, content: string) => run({
    action: () => $fetch(`/api/v1/notes/${id}`, { method: 'PATCH', body: { content } }),
    refresh: noteKeys(id),
    failure: 'save',
    rethrow: true,
  })

  // Pinning is a one-click toggle done repeatedly — silent on success.
  const togglePinned = (note: Pick<NoteRow, 'id' | 'pinned'>) => run({
    action: () => $fetch(`/api/v1/notes/${note.id}`, { method: 'PATCH', body: { pinned: !note.pinned } }),
    refresh: noteKeys(note.id),
    failure: 'update',
  })

  // No rethrow: the boolean tells the detail page whether to navigate away.
  async function confirmDelete(note: Pick<NoteRow, 'id' | 'title'>): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('notes.confirmDelete.title'),
      message: $i18n.t('notes.confirmDelete.message', { title: note.title }),
    })
    if (!confirmed) return false

    const result = await run({
      action: () => $fetch(`/api/v1/notes/${note.id}`, { method: 'DELETE' }),
      refresh: noteKeys(note.id),
      success: 'notes.toasts.deleted',
      failure: 'delete',
    })
    return result !== undefined
  }

  // Set by the detail page when it leaves *because the note is gone*. Without
  // it, deleting a note mid-edit would follow the delete confirmation with an
  // "unsaved changes" prompt about a draft that no longer has anywhere to go.
  const skipUnsavedGuard = ref(false)

  // --- Modal state (the modal is mounted once in the dashboard layout) ---
  // It edits a note's *details* (title + tags); the body is edited on the
  // detail page, where there's room for the editor and its preview.
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<NoteRow>()

  return {
    searchInput,
    activeTag,
    filters,
    hasFilters,
    toggleTag,
    clearFilters,
    createNote,
    updateNote,
    saveContent,
    togglePinned,
    confirmDelete,
    skipUnsavedGuard,
    modalOpen,
    editing,
    openCreate,
    openEdit,
  }
})
