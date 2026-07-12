<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()

// Settings sub-navigation. UI-only scaffold — each link points to a placeholder
// page. computed so the labels re-render when the locale switches.
const groups = computed<NavigationMenuItem[][]>(() => [
  [
    { label: t('settings.nav.general'), type: 'label' },
    { label: t('settings.nav.account'), icon: 'i-lucide-circle-user', to: '/app/settings/account' },
    { label: t('settings.nav.preferences'), icon: 'i-lucide-sliders-horizontal', to: '/app/settings/preferences' },
    { label: t('settings.nav.apiKey'), icon: 'i-lucide-key', to: '/app/settings/api-key' },
    { label: t('settings.nav.accounts'), icon: 'i-lucide-wallet', to: '/app/settings/accounts' },
    { label: t('settings.nav.imports'), icon: 'i-lucide-download', to: '/app/settings/imports' },
  ],
  [
    { label: t('settings.nav.transactions'), type: 'label' },
    { label: t('settings.nav.tags'), icon: 'i-lucide-tag', to: '/app/settings/tags' },
    { label: t('settings.nav.categories'), icon: 'i-lucide-shapes', to: '/app/settings/categories' },
    { label: t('settings.nav.rules'), icon: 'i-lucide-git-branch', to: '/app/settings/rules' },
    { label: t('settings.nav.merchants'), icon: 'i-lucide-store', to: '/app/settings/merchants' },
  ],
])
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar :title="$t('settings.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col lg:flex-row gap-6 lg:gap-10">
        <nav class="lg:w-56 lg:shrink-0">
          <UNavigationMenu
            :items="groups"
            orientation="vertical"
          />
        </nav>

        <div class="flex-1 min-w-0 max-w-2xl">
          <slot />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
