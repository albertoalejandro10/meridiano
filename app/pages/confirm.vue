<script setup lang="ts">
useSeoMeta({ title: 'Signing in…' })

const user = useSupabaseUser()

watch(user, (u) => {
  if (u) navigateTo('/app')
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-32">
    <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
    <p class="text-sm text-muted">
      Completing sign-in…
    </p>
  </div>
</template>
