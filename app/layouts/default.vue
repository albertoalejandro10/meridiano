<script setup lang="ts">
const { loggedIn } = useUserSession()
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <UHeader>
      <template #title>
        <NuxtLink to="/" class="flex items-center">
          <Logo class="text-xl" />
        </NuxtLink>
      </template>

      <template #right>
        <UButton
          v-if="loggedIn"
          to="/app"
          :label="$t('nav.dashboard')"
          icon="i-lucide-layout-dashboard"
          color="neutral"
          variant="ghost"
        />
        <UButton
          v-else
          to="/login"
          :label="$t('auth.signIn')"
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
        <span class="text-sm text-muted">{{ $t('landing.footer.tagline') }}</span>
      </template>
    </UFooter>
  </div>
</template>
