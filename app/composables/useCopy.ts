/**
 * Copy text to the clipboard and flip a short-lived `copied` flag, so a button
 * can acknowledge the copy without a toast (the point of a copy button is that
 * it's silent and repeatable).
 *
 * `navigator.clipboard` needs a secure context; when it's unavailable the flag
 * simply stays false rather than throwing at the call site.
 */
export function useCopy(resetAfter = 1500) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string): Promise<boolean> {
    if (!import.meta.client || !navigator.clipboard) return false

    try {
      await navigator.clipboard.writeText(text)
    }
    catch {
      return false
    }

    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, resetAfter)
    return true
  }

  onScopeDispose(() => clearTimeout(timer))

  return { copied, copy }
}
