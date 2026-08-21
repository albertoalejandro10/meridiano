import type { Ref } from 'vue'

/**
 * The shared mechanics of a store-driven modal form.
 *
 * `reset` runs every time the modal opens, so an edit never inherits the
 * previous row's values and a create never inherits the last edit's. `submit`
 * tracks the saving flag for the footer button and closes the modal only on
 * success — the store already toasted the failure, so a failed save leaves the
 * form open with the user's input intact for another attempt.
 *
 * `onSuccess` runs after the modal closes, for the forms that do something with
 * what they just created (navigate into it). `submit` resolves to void so it
 * can be handed straight to `<UForm @submit>`.
 */
export function useModalForm(open: Ref<boolean>, reset: () => void) {
  watch(open, (isOpen) => {
    if (isOpen) reset()
  })

  const saving = ref(false)

  async function submit<R>(save: () => Promise<R>, onSuccess?: (result: R) => void | Promise<void>): Promise<void> {
    saving.value = true
    try {
      const result = await save()
      open.value = false
      await onSuccess?.(result)
    }
    catch {
      // Toast handled in the store; keep the modal open for another attempt.
    }
    finally {
      saving.value = false
    }
  }

  return { saving, submit }
}
