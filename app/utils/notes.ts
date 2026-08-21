import type { NoteFilters } from '~/composables/useNotes'

// Client-side shape of a note row returned by /api/v1/notes.
export interface NoteRow {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

// One entry of the tag vocabulary: how many of the user's notes carry it.
export interface NoteTagCount {
  name: string
  count: number
}

/**
 * The `useFetch` key for a filtered note list. Shared by the composable that
 * fetches it and the store that refreshes it after a mutation, so the two can
 * never drift apart.
 */
export function notesKey(filters: NoteFilters): string {
  const parts = [filters.tag, filters.search].filter(Boolean)
  return parts.length ? `notes:${parts.join(':')}` : 'notes'
}

/**
 * The list-card preview: the note's opening prose, with the markdown syntax
 * that only makes sense rendered (fences, heading hashes, emphasis) stripped
 * out. A fenced block collapses to its first code line — for a snippet note
 * that command *is* the preview worth seeing.
 */
export function notePreview(content: string, max = 180): string {
  const text = content
    // Fenced blocks: drop the fence lines, keep what was inside.
    .replace(/^\s*```.*$/gm, '')
    // Leading markers: heading hashes, quotes, list bullets.
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
    // Inline emphasis/code markers, and link syntax down to its text.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/**
 * Every string leaf under a Comark AST node, in order — the raw source of a
 * rendered code fence, which is what the copy button puts on the clipboard.
 * Nodes are `[tag, props, ...children]`; children are strings or more nodes.
 */
export function comarkText(node: unknown): string {
  if (typeof node === 'string') return node
  if (!Array.isArray(node)) return ''
  return node.slice(2).map(comarkText).join('')
}
