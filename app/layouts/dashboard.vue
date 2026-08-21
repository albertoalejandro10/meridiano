<script setup lang="ts">
const { t } = useI18n()

const collapsed = ref(true)

// Badge the nav with what's waiting to be answered, so a due bill is visible
// from any page — not only from the dashboard banner.
const { pending } = storeToRefs(useRecurringStore())

// computed so the labels re-render when the locale switches
const links = computed(() => [
  { label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/app' },
  { label: t('nav.chat'), icon: 'i-lucide-sparkles', to: '/app/chat' },
  { label: t('nav.transactions'), icon: 'i-lucide-arrow-left-right', to: '/app/transactions' },
  { label: t('nav.analytics'), icon: 'i-lucide-chart-pie', to: '/app/analytics' },
  { label: t('nav.accounts'), icon: 'i-lucide-wallet', to: '/app/accounts' },
  { label: t('nav.recurring'), icon: 'i-lucide-repeat', to: '/app/recurring', badge: pending.value.length || undefined },
  { label: t('nav.budgets'), icon: 'i-lucide-piggy-bank', to: '/app/budgets' },
  { label: t('nav.goals'), icon: 'i-lucide-target', to: '/app/goals' },
  { label: t('nav.planning'), icon: 'i-lucide-route', to: '/app/planning' },
  { label: t('nav.shoppingLists'), icon: 'i-lucide-shopping-cart', to: '/app/shopping-lists' },
  { label: t('nav.tasks'), icon: 'i-lucide-list-todo', to: '/app/tasks' },
  { label: t('nav.notes'), icon: 'i-lucide-notebook-pen', to: '/app/notes' },
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
    <AccountReconcileModal />
    <GoalModal />
    <BudgetModal />
    <ShoppingListModal />
    <TaskModal />
    <TaskLongModal />
    <TaskCategoryModal />
    <NoteModal />
    <RecurringModal />
    <RecurringReviewModal />
  </UDashboardGroup>
</template>
