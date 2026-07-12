import { LazyConfirmModal } from '#components'

export const useConfirm = () => {
  const overlay = useOverlay()

  const confirm = async (options?: {
    title?: string
    message?: string
  }): Promise<boolean> => {
    // $i18n instead of useI18n(): confirm() is called from stores/event
    // handlers where there is no component instance.
    const { $i18n } = useNuxtApp()
    // Created per call with destroyOnClose: useOverlay keeps instances in an
    // app-lifetime list, so a long-lived instance per component would pile up
    // across page navigations.
    const modal = overlay.create(LazyConfirmModal, { destroyOnClose: true })
    const instance = modal.open({
      title: options?.title || $i18n.t('confirm.title'),
      message: options?.message || $i18n.t('confirm.message'),
    })

    return await instance.result
  }

  return { confirm }
}
