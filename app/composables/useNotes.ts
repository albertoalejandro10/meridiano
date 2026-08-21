export interface NoteFilters {
  /** Case-insensitive substring match over title + content. */
  search?: string
  /** Exact (already normalised) tag. */
  tag?: string
}

// Filter-keyed note list, plus the user's whole tag vocabulary for the filter
// chips. Fetch-only: mutations live on the notes store (useNotesStore), which
// knows the active filters and so can rebuild this key to refresh it.
export function useNotes(filters: Ref<NoteFilters>) {
  // The key must track the filters — a search result and the full list are
  // different queries and must never share one cache entry.
  return useFetch('/api/v1/notes', {
    key: computed(() => notesKey(filters.value)),
    query: filters,
    default: () => ({ notes: [] as NoteRow[], tags: [] as NoteTagCount[] }),
  })
}

export function useNote(id: string) {
  return useFetch(`/api/v1/notes/${id}`, { key: `note-${id}` })
}
