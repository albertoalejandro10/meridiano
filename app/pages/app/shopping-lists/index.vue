<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('shoppingLists.title') })

const listsStore = useShoppingListsStore()
const { lists } = storeToRefs(listsStore)

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'shoppingLists.title', icon: 'i-lucide-shopping-cart', to: '/app/shopping-lists' },
])
</script>

<template>
  <UDashboardPanel id="shopping-lists">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('shoppingLists.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('shoppingLists.subtitle') }}
          </p>
        </div>
        <UButton :label="$t('shoppingLists.new')" icon="i-lucide-plus" @click="listsStore.openCreate()" />
      </div>

      <UPageGrid v-if="lists.length" class="lg:grid-cols-3">
        <ShoppingListCard
          v-for="list in lists"
          :key="list.id"
          :list="list"
          @edit="listsStore.openEdit(list)"
          @delete="listsStore.confirmDelete(list)"
        />
      </UPageGrid>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-shopping-cart" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('shoppingLists.empty') }}
        </p>
        <UButton :label="$t('shoppingLists.new')" icon="i-lucide-plus" @click="listsStore.openCreate()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
