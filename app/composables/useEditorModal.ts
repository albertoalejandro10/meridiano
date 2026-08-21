import type { Ref } from 'vue'

/**
 * The modal-state quartet every store that drives a create/edit modal repeats:
 * whether it's open, what it's editing, and the two ways to open it.
 *
 * `editing` doubles as the mode switch — set means edit, unset means create.
 * `openCreate` takes an optional prefill so shortcuts ("budget this category",
 * "track this subscription") can open the form ready to save; the prefill is
 * copied so editing the form never mutates the row it came from.
 *
 * Spread the result into the store's return so `storeToRefs(store).modalOpen`
 * keeps working in the components that consume it.
 */
export function useEditorModal<T, P extends T = T>() {
  const modalOpen = ref(false)
  // The generic makes Vue's ref-unwrapping types collapse; the cast pins the
  // public shape back to what callers actually get.
  const editing = ref<T | undefined>() as Ref<T | undefined>

  function openCreate(prefill?: P) {
    editing.value = prefill ? { ...prefill } : undefined
    modalOpen.value = true
  }

  function openEdit(item: T) {
    editing.value = item
    modalOpen.value = true
  }

  return { modalOpen, editing, openCreate, openEdit }
}
