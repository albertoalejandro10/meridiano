<script setup lang="ts">
const { t } = useI18n()

const collapsed = ref(true)

// computed so the labels re-render when the locale switches
const links = computed(() => [
  { label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/app' },
  { label: t('nav.transactions'), icon: 'i-lucide-arrow-left-right', to: '/app/transactions' },
  { label: t('nav.accounts'), icon: 'i-lucide-wallet', to: '/app/accounts' },
  { label: t('nav.goals'), icon: 'i-lucide-target', to: '/app/goals' },
])
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      v-model:collapsed="collapsed"
      collapsible
      resizable
      :default-size="18"
      :min-size="14"
      :max-size="25"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/app" class="flex items-center">
          <Logo v-if="collapsed" symbol class="size-6 shrink-0" />
          <Logo v-else class="text-lg" />
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
        <div class="flex flex-col gap-1.5 w-full">
          <div class="flex items-center gap-1.5" :class="collapsed ? 'flex-col' : ''">
            <UDashboardSidebarCollapse />
            <ThemePicker />
          </div>
          <UserMenu :collapsed="collapsed" />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />

    <!-- App-wide overlays: mounted once here, opened via their store actions
         (e.g. useGoalsStore().openEdit(goal)) instead of per-page mounts. -->
    <TransactionModal />
    <TransferModal />
    <AccountModal />
    <AssetSellModal />
    <GoalModal />
  </UDashboardGroup>
</template>
