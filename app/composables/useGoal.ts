// A single goal with its progress detail (for the detail page). Fetch-only:
// mutations live on the goals store (useGoalsStore), which refreshes/clears
// this per-id key after updates and deletes.
export function useGoal(id: string) {
  return useFetch(`/api/v1/goals/${id}`, { key: `goal-${id}` })
}
