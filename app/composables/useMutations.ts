// The four generic failure titles in `common.toasts` — passed as a shorthand
// (`failure: 'update'` → `common.toasts.updateFailed`). Anything else is used
// verbatim as an i18n key, for mutations with a specific message of their own.
type FailureKind = 'create' | 'update' | 'delete' | 'save'

// $fetch surfaces an h3 `createError` as a FetchError: the status lives on the
// error, and the serialized body (carrying statusMessage again) on `.data`.
interface MutationError {
  statusCode?: number
  statusMessage?: string
  data?: { statusMessage?: string }
}

/** The server's statusMessage, wherever $fetch put it. */
export function errorMessage(e: unknown): string | undefined {
  const err = e as MutationError
  return err.data?.statusMessage ?? err.statusMessage
}

/** The status code of a failed $fetch, for mutations that branch on it. */
export function errorStatus(e: unknown): number | undefined {
  return (e as MutationError).statusCode
}

export interface MutationOptions<T> {
  action: () => Promise<T>
  /**
   * What the mutation invalidated: cache keys to refetch, or the store's own
   * `refresh()`. Pass `() => refreshNuxtData()` for mutations that change data
   * derived elsewhere (balances, goal progress) and must refresh everything.
   */
  refresh?: string[] | (() => Promise<unknown>)
  /** i18n key for the success toast; omit to stay silent (e.g. ticking a checkbox). */
  success?: string
  /**
   * A `FailureKind` shorthand, a specific i18n key, or a builder for errors that
   * need to inspect the status code.
   */
  failure: FailureKind | (string & {}) | ((e: unknown) => { title: string, description?: string })
  /** Rethrow after toasting, so the calling modal can stay open for another attempt. */
  rethrow?: boolean
  /** Refresh on failure too — for optimistic updates that must snap back. */
  refreshOnError?: boolean
}

const FAILURE_KINDS = ['create', 'update', 'delete', 'save']

/**
 * The shared shape of every store mutation: run it, refresh what it
 * invalidated, toast the outcome. On failure the server's `statusMessage`
 * becomes the toast description, and `rethrow` lets the calling modal stay open.
 *
 * Resolves to the action's result, or `undefined` when it failed and did not
 * rethrow — so callers that report success return `(await run(…)) !== undefined`.
 *
 * Stores can't use `useI18n()` (no component instance), so translation goes
 * through `$i18n` — and happens inside `run` at event time, never at setup, so a
 * locale switch never leaves a stale-language toast.
 */
export function useMutations() {
  const toast = useToast()
  const { $i18n } = useNuxtApp()

  async function applyRefresh(refresh: MutationOptions<unknown>['refresh']) {
    if (!refresh) return
    if (Array.isArray(refresh)) await refreshNuxtData(refresh)
    else await refresh()
  }

  // With `rethrow`, a failure throws rather than returning — so the result is
  // always the action's value, and callers need no undefined check.
  function run<T>(options: MutationOptions<T> & { rethrow: true }): Promise<T>
  function run<T>(options: MutationOptions<T>): Promise<T | undefined>
  async function run<T>(options: MutationOptions<T>): Promise<T | undefined> {
    try {
      const result = await options.action()
      await applyRefresh(options.refresh)
      if (options.success) toast.add({ title: $i18n.t(options.success), color: 'success' })
      return result
    }
    catch (e: unknown) {
      const { failure } = options
      const { title, description } = typeof failure === 'function'
        ? failure(e)
        : {
            title: $i18n.t(FAILURE_KINDS.includes(failure) ? `common.toasts.${failure}Failed` : failure),
            description: errorMessage(e),
          }
      toast.add({ title, description, color: 'error' })

      if (options.refreshOnError) await applyRefresh(options.refresh)
      if (options.rethrow) throw e
      return undefined
    }
  }

  return { run }
}
