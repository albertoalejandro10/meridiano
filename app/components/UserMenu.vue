<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()

const user = useSupabaseUser()
const supabase = useSupabaseClient()
const colorMode = useColorMode()

const displayName = computed(() =>
  (user.value?.user_metadata?.full_name as string | undefined)
  ?? user.value?.email
  ?? 'Account',
)
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url as string | undefined)

async function signOut() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const items = computed(() => [
  [{
    label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
    icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
    onSelect: () => {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  }],
  [{
    label: 'Sign out',
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
      <UAvatar :src="avatarUrl" :alt="displayName" size="2xs" />
      <span v-if="!collapsed" class="truncate">{{ displayName }}</span>
    </UButton>
  </UDropdownMenu>
</template>
