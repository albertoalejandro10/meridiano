<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed?: boolean }>()

const { user, clear } = useUserSession()
const { t } = useI18n()

const displayName = computed(() => user.value?.name ?? user.value?.email ?? t('nav.account'))

async function signOut() {
  await clear()
  await navigateTo('/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{
    type: 'label',
    label: displayName.value,
    // Only show the email as a second line when a distinct name is set.
    description: user.value?.name ? user.value.email : undefined,
    avatar: { alt: displayName.value },
  }],
  [{
    label: t('nav.settings'),
    icon: 'i-lucide-settings',
    to: '/app/settings/account',
  }],
  [{
    label: t('nav.signOut'),
    icon: 'i-lucide-log-out',
    onSelect: signOut,
  }],
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="justify-start"
    >
      <UAvatar :alt="displayName" size="2xs" />
      <span v-if="!collapsed" class="truncate">{{ displayName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
