<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = route.params.id as string

const { t } = useI18n()

const { data: list, error } = useShoppingList(id)
const listsStore = useShoppingListsStore()

useSeoMeta({ title: () => list.value?.name ?? t('shoppingLists.title') })

const itemTotal = (i: { quantity: string, unitPrice: string }) => Number(i.quantity) * Number(i.unitPrice)

// Crossing an item off means it's already in the cart, so it drops out of the
// total: "total to buy" (and the dollars to sell for it) is what's still left.
const totalVes = computed(() =>
  (list.value?.items ?? []).filter(i => !i.checked).reduce((sum, i) => sum + itemTotal(i), 0),
)
// The whole trip, checked items included — shown alongside once something is
// crossed out so the full cost doesn't disappear.
const fullTotalVes = computed(() =>
  (list.value?.items ?? []).reduce((sum, i) => sum + itemTotal(i), 0),
)
const checkedCount = computed(() => (list.value?.items ?? []).filter(i => i.checked).length)

async function onDelete() {
  // Only leave the page when the delete actually succeeded.
  if (list.value && await listsStore.confirmDelete(list.value)) {
    await navigateTo('/app/shopping-lists')
  }
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'shoppingLists.title', icon: 'i-lucide-shopping-cart', to: '/app/shopping-lists' },
  { label: () => list.value?.name },
])
</script>

<template>
  <UDashboardPanel id="shopping-list-detail">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div v-if="error" class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('shoppingLists.notFound') }}
        </p>
        <UButton to="/app/shopping-lists" :label="$t('shoppingLists.backToLists')" />
      </div>

      <div v-else-if="list" class="space-y-6">
        <!-- header -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-shopping-cart" class="size-6" />
            </span>
            <div class="min-w-0">
              <h1 class="truncate text-xl font-semibold">
                {{ list.name }}
              </h1>
              <p class="text-sm text-muted">
                {{ $t('shoppingLists.itemCount', { count: list.items.length }, list.items.length) }}
                <template v-if="list.items.length"> · {{ $t('shoppingLists.checkedCount', { checked: checkedCount, total: list.items.length }) }}</template>
              </p>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" @click="listsStore.openEdit(list)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" @click="onDelete" />
          </div>
        </div>

        <ShoppingListRatesPanel
          :list-id="list.id"
          :bcv-rate="list.bcvRate"
          :binance-rate="list.binanceRate"
          :total-ves="totalVes"
          :full-total-ves="checkedCount ? fullTotalVes : undefined"
        />

        <ShoppingListItemsTable :list-id="list.id" :items="list.items" />
      </div>
    </template>
  </UDashboardPanel>
</template>
