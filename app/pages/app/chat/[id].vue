<script setup lang="ts">
import type { UIMessage } from 'ai'
import type { ChatConversationSummary } from '~/stores/chat'

// Forces a full remount per conversation id, so useChat() only ever needs to
// initialize once per component instance — no reactive re-init juggling.
definePageMeta({ layout: 'dashboard', key: route => route.params.id as string })

const route = useRoute()
const conversationId = route.params.id as string
const { t } = useI18n()

// Typed explicitly: the URL is a template literal, so Nitro can't match it to a
// route and would otherwise infer `{}`. The detail endpoint is the summary plus
// its messages, already in UIMessage shape for useChat().
type ConversationDetail = ChatConversationSummary & { messages: UIMessage[] }

const { data: conversation, error: loadError } = await useFetch<ConversationDetail>(
  `/api/v1/ai/chat/conversations/${conversationId}`,
  { key: `chat-conversation-${conversationId}` },
)

if (loadError.value) {
  await navigateTo('/app/chat')
}

useSeoMeta({ title: () => conversation.value?.title || t('chat.title') })
</script>

<template>
  <ChatShell>
    <ChatConversation
      v-if="conversation"
      :conversation-id="conversationId"
      :model="conversation.model"
      :initial-messages="conversation.messages"
    />
  </ChatShell>
</template>
