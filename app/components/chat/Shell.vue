<script setup lang="ts">
// Shared shell for /app/chat and /app/chat/[id] — mirrors SettingsLayout's
// pattern: each page wraps itself in this instead of a nested route layout.
const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'chat.title', icon: 'i-lucide-sparkles', to: '/app/chat' },
])

// A fixed 256px conversation list is most of a phone screen, so below lg it
// moves into a slideover — the same trade the dashboard sidebar makes by
// collapsing. The list closes itself on navigation (its `navigate` event).
const listOpen = ref(false)
</script>

<template>
  <UDashboardPanel id="chat">
    <template #body>
      <div class="flex h-full min-h-0 flex-col gap-4">
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            icon="i-lucide-panel-left"
            color="neutral"
            variant="ghost"
            size="sm"
            class="lg:hidden"
            :aria-label="$t('chat.showConversations')"
            @click="listOpen = true"
          />
          <UBreadcrumb :items="breadcrumbItems" />
        </div>

        <div class="flex flex-1 min-h-0 gap-4">
          <div class="hidden w-64 shrink-0 border-r border-default pr-4 lg:block">
            <ChatSidebar />
          </div>
          <div class="min-h-0 min-w-0 flex-1">
            <slot />
          </div>
        </div>
      </div>

      <USlideover v-model:open="listOpen" side="left" :title="$t('chat.title')">
        <template #body>
          <ChatSidebar @navigate="listOpen = false" />
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
