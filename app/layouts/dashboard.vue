<script setup lang="ts">
const links = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/app' },
  { label: 'Transactions', icon: 'i-lucide-arrow-left-right', to: '/app/transactions' },
  { label: 'Accounts', icon: 'i-lucide-wallet', to: '/app/accounts' },
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible resizable :ui="{ footer: 'border-t border-default' }">
      <template #header="{ collapsed }">
        <NuxtLink to="/app" class="flex items-center gap-2 font-bold">
          <UIcon name="i-lucide-piggy-bank" class="size-6 text-primary shrink-0" />
          <span v-if="!collapsed">BetoTracker</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="links"
          :collapsed="collapsed"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
