// A single shopping list with its items (for the detail page). Fetch-only:
// mutations live on the shopping-lists store, which refreshes/clears this
// per-id key after updates and deletes.
export function useShoppingList(id: string) {
  return useFetch(`/api/v1/shopping-lists/${id}`, { key: `shopping-list-${id}` })
}
