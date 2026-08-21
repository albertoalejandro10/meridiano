export interface ChatConversationSummary {
  id: string
  title: string | null
  model: string
  createdAt: string
  updatedAt: string
}

// Owns the conversation list only (CRUD) — the live message stream for
// whichever conversation is open lives in useChat(), inside the [id] page.
export const useChatStore = defineStore('chat', () => {
  const { data: conversations, refresh, status } = useFetch<ChatConversationSummary[]>('/api/v1/ai/chat/conversations', {
    key: 'chatConversations',
    default: () => [],
  })

  const { confirm } = useConfirm()
  const { run } = useMutations()
  // Stores can't use useI18n() (no component instance) — $i18n is the safe
  // accessor, translated at action time so a locale switch never leaves
  // stale-language toasts.
  const { $i18n } = useNuxtApp()

  // Silent on success: the new conversation opening is its own confirmation.
  const createConversation = (model: string) => run({
    action: () => $fetch('/api/v1/ai/chat/conversations', { method: 'POST', body: { model } }),
    refresh,
    failure: 'chat.toasts.createFailed',
    rethrow: true,
  })

  const renameConversation = (id: string, title: string) => run({
    action: () => $fetch(`/api/v1/ai/chat/conversations/${id}`, { method: 'PATCH', body: { title } }),
    refresh,
    success: 'chat.toasts.renamed',
    failure: 'chat.toasts.renameFailed',
    rethrow: true,
  })

  async function deleteConversation(id: string): Promise<boolean> {
    const result = await run({
      action: () => $fetch(`/api/v1/ai/chat/conversations/${id}`, { method: 'DELETE' }),
      refresh,
      success: 'chat.toasts.deleted',
      failure: 'chat.toasts.deleteFailed',
    })
    return result !== undefined
  }

  async function confirmDelete(conversation: { id: string, title: string | null }): Promise<boolean> {
    const confirmed = await confirm({
      title: $i18n.t('chat.confirmDelete.title'),
      message: $i18n.t('chat.confirmDelete.message', { title: conversation.title || $i18n.t('chat.untitled') }),
    })
    return confirmed ? await deleteConversation(conversation.id) : false
  }

  return { conversations, refresh, status, createConversation, renameConversation, deleteConversation, confirmDelete }
})
