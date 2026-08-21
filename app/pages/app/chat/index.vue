<script setup lang="ts">
import { chatModels, DEFAULT_CHAT_MODEL } from '~~/shared/schemas'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

useSeoMeta({ title: () => t('chat.title') })

// Model chosen in the sidebar's "New chat" picker, carried via query param —
// nothing is persisted yet, so there's no conversation row to store it on.
const model = computed(() => {
  const q = route.query.model
  return typeof q === 'string' && (chatModels as readonly string[]).includes(q) ? q : DEFAULT_CHAT_MODEL
})

async function onCreated(id: string) {
  await router.replace(`/app/chat/${id}`)
}
</script>

<template>
  <ChatShell>
    <ChatConversation :model="model" @created="onCreated" />
  </ChatShell>
</template>
