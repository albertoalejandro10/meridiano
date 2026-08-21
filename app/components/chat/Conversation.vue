<script setup lang="ts">
import type { UIMessage } from 'ai'
import { useChat } from '@ai-sdk/vue'
import { DefaultChatTransport, isToolUIPart } from 'ai'

// A conversation with no `conversationId` is a fresh, unsaved chat — nothing
// is persisted until the first message is actually sent (see
// prepareSendMessagesRequest below). This is what stops "New chat" from
// littering the sidebar with empty conversations nobody ever wrote in.
const props = defineProps<{
  conversationId?: string
  model: string
  initialMessages?: UIMessage[]
}>()

const emit = defineEmits<{ created: [id: string] }>()

const { t, locale } = useI18n()
const toast = useToast()
const chatStore = useChatStore()

const pendingId = ref(props.conversationId)

const transport = new DefaultChatTransport({
  api: '/api/v1/ai/chat/conversations/pending/messages',
  prepareSendMessagesRequest: async ({ messages, trigger }) => {
    if (!pendingId.value) {
      const created = await chatStore.createConversation(props.model)
      pendingId.value = created.id
      // Surface the new conversation in the sidebar right away, not only
      // once the first response finishes streaming.
      await chatStore.refresh()
    }
    // On a retry the question is already stored server-side, so `text` is only
    // a fallback for the guard in the handler — the flag is what stops it
    // being written a second time.
    const retry = trigger === 'regenerate-message'
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const text = lastUser?.parts?.filter(p => p.type === 'text').map(p => p.text).join('') ?? ''
    return {
      api: `/api/v1/ai/chat/conversations/${pendingId.value}/messages`,
      body: { text, locale: locale.value, retry },
    }
  },
})

const { messages, sendMessage, regenerate, status, error, stop } = useChat({
  id: props.conversationId ?? 'new',
  messages: props.initialMessages ?? [],
  transport,
})

watch(error, (e) => {
  if (e) toast.add({ title: t('chat.sendFailed'), description: e.message, color: 'error' })
})

// A turn can fail two ways from here. In this session `error` is set, and the
// half-streamed reply is usually still on screen. After a reload — a new chat
// navigates to its own page as soon as the turn ends, failed or not — all
// that's left is the question with nothing after it, since the server no
// longer stores a broken reply. Both need the same way out, because re-typing
// the question would just ask it twice.
const unanswered = computed(() =>
  status.value === 'ready' && messages.value[messages.value.length - 1]?.role === 'user',
)
const failedTurn = computed(() => Boolean(error.value) || unanswered.value)

// The toast is easy to miss and it disappears; this is the durable affordance.
async function retry() {
  if (status.value === 'streaming' || status.value === 'submitted') return
  await regenerate()
  await chatStore.refresh()
}

const input = ref('')
async function submit() {
  const text = input.value.trim()
  if (!text || status.value !== 'ready') return
  input.value = ''
  const wasNew = !props.conversationId
  await sendMessage({ text })
  // Picks up the server-derived title (set once the first turn finishes) and
  // keeps the sidebar's updatedAt ordering current on every later message too.
  await chatStore.refresh()
  if (wasNew && pendingId.value) emit('created', pendingId.value)
}

function toolLabel(type: string) {
  return type.startsWith('tool-') ? type.slice('tool-'.length) : type
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <!-- UChatMessages has no scroll boundary of its own — it walks up the DOM
         for the nearest `overflow-y: auto` ancestor and falls back to
         scrolling the whole document if it doesn't find one close by. This
         div is that boundary, so only the messages scroll, not the page. -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="!messages.length" class="flex h-full flex-col items-center justify-center gap-3 text-center">
        <UIcon name="i-lucide-sparkles" class="size-10 text-muted" />
        <p class="text-lg font-medium">
          {{ $t('chat.empty.title') }}
        </p>
        <p class="max-w-sm text-sm text-muted">
          {{ $t('chat.empty.description') }}
        </p>
      </div>

      <UChatMessages v-else :messages="messages" :status="status">
        <template #content="{ message }">
          <div class="flex flex-col gap-2">
            <template v-for="(part, i) in message.parts" :key="i">
              <Comark v-if="part.type === 'text'">
                {{ part.text }}
              </Comark>
              <UChatTool
                v-else-if="isToolUIPart(part)"
                :text="toolLabel(part.type)"
                :loading="part.state === 'input-streaming' || part.state === 'input-available'"
              >
                <pre class="overflow-x-auto text-xs">{{ JSON.stringify('output' in part ? part.output : part.input, null, 2) }}</pre>
              </UChatTool>
            </template>
          </div>
        </template>
      </UChatMessages>

      <div
        v-if="failedTurn"
        class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/30 bg-error/5 px-4 py-3"
      >
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-error" />
          <div>
            <p class="text-sm font-medium">
              {{ $t('chat.sendFailed') }}
            </p>
            <p class="text-sm text-muted">
              {{ error?.message ?? $t('chat.noReply') }}
            </p>
          </div>
        </div>
        <UButton
          :label="$t('chat.retry')"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="status === 'submitted' || status === 'streaming'"
          class="shrink-0"
          @click="retry"
        />
      </div>
    </div>

    <UChatPrompt v-model="input" :placeholder="$t('chat.inputPlaceholder')" @submit="submit">
      <template #footer>
        <p class="text-xs text-muted">
          {{ $t('chat.disclosure') }}
        </p>
        <UChatPromptSubmit :status="status" class="ml-auto" @stop="stop" />
      </template>
    </UChatPrompt>
  </div>
</template>
