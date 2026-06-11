<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader>
      <template #title>
        <span class="font-bold">BetoTracker</span>
      </template>

      <template #right>
        <UButton
          v-if="user"
          to="/app"
          label="Dashboard"
          icon="i-lucide-layout-dashboard"
          color="neutral"
          variant="ghost"
        />
        <UButton
          v-else
          to="/login"
          label="Sign in"
          icon="i-lucide-log-in"
          color="neutral"
          variant="ghost"
        />
        <UColorModeButton />
      </template>
    </UHeader>

    <main class="flex-1">
      <slot />
    </main>

    <UFooter>
      <template #left>
        <span class="text-sm text-muted">BetoTracker · Personal finance, fast.</span>
      </template>
    </UFooter>
  </div>
</template>
