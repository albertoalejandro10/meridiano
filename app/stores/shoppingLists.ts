import type { ShoppingListInput, ShoppingListItemInput } from '~~/shared/schemas'

// Structural list shape the modal edits — satisfied by both list items and the
// detail payload (`/api/v1/shopping-lists` and `/api/v1/shopping-lists/:id`).
export interface ShoppingListModalList {
  id: string
  name: string
}

export const useShoppingListsStore = defineStore('shoppingLists', () => {
  const { data: lists, refresh, status } = useFetch('/api/v1/shopping-lists', {
    key: 'shopping-lists',
    default: () => [],
  })

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor. Translate inside action bodies (event time), never at setup,
  // so a locale switch never leaves stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Both keys after any list change; the detail key is a no-op when that page
  // isn't loaded.
  const listKeys = (id: string) => ['shopping-lists', `shopping-list-${id}`]

  // Create/update rethrow so the calling modal can stay open on failure.
  const createList = (input: ShoppingListInput) => run({
    action: () => $fetch('/api/v1/shopping-lists', { method: 'POST', body: input }),
    refresh,
    success: 'shoppingLists.toasts.created',
    failure: 'create',
    rethrow: true,
  })

  const updateList = (id: string, input: Partial<ShoppingListInput>) => run({
    action: () => $fetch(`/api/v1/shopping-lists/${id}`, { method: 'PATCH', body: input }),
    refresh: listKeys(id),
    success: 'shoppingLists.toasts.updated',
    failure: 'update',
    rethrow: true,
  })

  // Rate edits happen on blur/refresh, several per visit — persist silently
  // (error toast only) so the panel doesn't toast on every keystroke.
  const saveRates = (id: string, rates: { bcvRate?: number | null, binanceRate?: number | null }) => run({
    action: () => $fetch(`/api/v1/shopping-lists/${id}`, { method: 'PATCH', body: rates }),
    refresh: listKeys(id),
    failure: 'update',
  })

  // No rethrow: the boolean tells callers whether to navigate away afterwards.
  async function deleteList(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/shopping-lists/${id}`, { method: 'DELETE' }),
      refresh,
      success: 'shoppingLists.toasts.deleted',
      failure: 'delete',
    })
    if (result === undefined) return false

    // Never refetch a deleted list — drop its cached detail payload so
    // back-navigation to its URL doesn't serve the corpse.
    clearNuxtData(`shopping-list-${id}`)
    return true
  }

  // --- Items ---
  // Fast entry posts one item per row through a queue in the items table, so
  // successes stay silent (a toast per grocery item is noise); errors rethrow
  // for the entry row to repopulate what failed.
  const addItem = (listId: string, input: ShoppingListItemInput) => run({
    action: () => $fetch(`/api/v1/shopping-lists/${listId}/items`, { method: 'POST', body: input }),
    refresh: listKeys(listId),
    failure: 'create',
    rethrow: true,
  })

  const updateItem = (listId: string, itemId: string, input: Partial<ShoppingListItemInput>) => run({
    action: () => $fetch(`/api/v1/shopping-lists/${listId}/items/${itemId}`, { method: 'PATCH', body: input }),
    refresh: listKeys(listId),
    failure: 'update',
    rethrow: true,
  })

  async function deleteItem(listId: string, itemId: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/shopping-lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
      refresh: listKeys(listId),
      failure: 'delete',
    })
    return result !== undefined
  }

  async function confirmDeleteItem(listId: string, item: { id: string, name: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('shoppingLists.confirmDeleteItem.title'),
      message: $i18n.t('shoppingLists.confirmDeleteItem.message', { name: item.name }),
    })
    return confirmed ? await deleteItem(listId, item.id) : false
  }

  // --- List modal (create/rename) ---
  const { modalOpen, editing, openCreate, openEdit } = useEditorModal<ShoppingListModalList>()

  async function confirmDelete(list: { id: string, name: string }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('shoppingLists.confirmDelete.title'),
      message: $i18n.t('shoppingLists.confirmDelete.message', { name: list.name }),
    })
    return confirmed ? await deleteList(list.id) : false
  }

  return {
    lists,
    refresh,
    status,
    createList,
    updateList,
    saveRates,
    deleteList,
    addItem,
    updateItem,
    deleteItem,
    confirmDeleteItem,
    modalOpen,
    editing,
    openCreate,
    openEdit,
    confirmDelete,
  }
})
