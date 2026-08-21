<script setup lang="ts">
// Summary shape returned by /api/v1/shopping-lists (counts + total precomputed).
export interface ShoppingListSummary {
  id: string
  name: string
  itemCount: number
  checkedCount: number
  totalVes: number
}

defineProps<{ list: ShoppingListSummary }>()
defineEmits<{ edit: [], delete: [] }>()

const { formatMoney } = useLocaleFormat()
</script>

<template>
  <div class="relative flex flex-col gap-4 rounded-lg p-5 ring ring-default bg-elevated/40 transition-colors hover:bg-elevated">
    <NuxtLink :to="`/app/shopping-lists/${list.id}`" class="absolute inset-0 rounded-lg" :aria-label="$t('shoppingLists.card.view', { name: list.name })" />

    <!-- header -->
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UIcon name="i-lucide-shopping-cart" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="truncate font-medium">
            {{ list.name }}
          </p>
          <p class="text-xs text-muted">
            {{ $t('shoppingLists.itemCount', { count: list.itemCount }, list.itemCount) }}
          </p>
        </div>
      </div>
      <div class="relative z-10 flex gap-1">
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="$emit('edit')" />
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="$emit('delete')" />
      </div>
    </div>

    <!-- total + progress -->
    <div class="space-y-1">
      <p class="text-lg font-semibold tabular-nums">
        {{ formatMoney(list.totalVes, 'VES') }}
      </p>
      <p v-if="list.itemCount" class="text-xs text-muted">
        {{ $t('shoppingLists.checkedCount', { checked: list.checkedCount, total: list.itemCount }) }}
      </p>
    </div>
  </div>
</template>
