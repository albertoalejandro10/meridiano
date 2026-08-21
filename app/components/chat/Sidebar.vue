<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ChatConversationSummary } from '~/stores/chat'
import { DEFAULT_CHAT_MODEL } from '~~/shared/schemas'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const { conversations } = storeToRefs(chatStore)

// Emitted whenever navigation happens, so the mobile slideover wrapping this
// (see ChatShell) can close itself — on desktop the sidebar is always visible
// and nothing listens.
const emit = defineEmits<{ navigate: [] }>()

const newChatModel = ref(DEFAULT_CHAT_MODEL)

// Just navigates to a blank compose screen — nothing is created until the
// user actually sends a first message (see ChatConversation.vue), so
// clicking "New chat" repeatedly never litters the list with empty rows.
function startNewChat() {
  router.push({ path: '/app/chat', query: { model: newChatModel.value } })
  emit('navigate')
}

const renamingId = ref<string | null>(null)
const renameDraft = ref('')

function startRename(conversation: ChatConversationSummary) {
  renamingId.value = conversation.id
  renameDraft.value = conversation.title || ''
}

async function commitRename(conversation: ChatConversationSummary) {
  const title = renameDraft.value.trim()
  renamingId.value = null
  if (title && title !== conversation.title) {
    await chatStore.renameConversation(conversation.id, title)
  }
}

async function removeConversation(conversation: ChatConversationSummary) {
  const wasActive = route.params.id === conversation.id
  const deleted = await chatStore.confirmDelete(conversation)
  if (deleted && wasActive) {
    await router.push('/app/chat')
  }
}

function menuItems(conversation: ChatConversationSummary): DropdownMenuItem[][] {
  return [
    [{ label: t('common.rename'), icon: 'i-lucide-pencil', onSelect: () => startRename(conversation) }],
    [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => removeConversation(conversation) }],
  ]
}
</script>

<template>
  <nav class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex items-center gap-2">
      <ChatModelPicker v-model="newChatModel" class="w-auto flex-1" />
      <UButton
        icon="i-lucide-plus"
        color="primary"
        :aria-label="$t('chat.newConversation')"
        @click="startNewChat"
      />
    </div>

    <ul v-if="conversations.length" class="flex flex-1 flex-col gap-0.5 overflow-y-auto">
      <li
        v-for="conversation in conversations"
        :key="conversation.id"
        class="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-elevated/50"
        :class="route.params.id === conversation.id ? 'bg-elevated' : ''"
      >
        <UInput
          v-if="renamingId === conversation.id"
          v-model="renameDraft"
          autofocus
          size="xs"
          class="min-w-0 flex-1"
          @keyup.enter="commitRename(conversation)"
          @keyup.esc="renamingId = null"
          @blur="commitRename(conversation)"
        />
        <NuxtLink
          v-else
          :to="`/app/chat/${conversation.id}`"
          class="min-w-0 flex-1 truncate text-sm"
          @click="emit('navigate')"
        >
          {{ conversation.title || $t('chat.untitled') }}
        </NuxtLink>

        <UDropdownMenu v-if="renamingId !== conversation.id" :items="menuItems(conversation)">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            size="xs"
            class="opacity-0 group-hover:opacity-100"
            :aria-label="$t('chat.conversationActions')"
          />
        </UDropdownMenu>
      </li>
    </ul>

    <p v-else class="px-2 text-sm text-muted">
      {{ $t('chat.noConversations') }}
    </p>
  </nav>
</template>
