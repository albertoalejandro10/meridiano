<script setup lang="ts">
import type { TransactionFilters } from '~/composables/useTransactions'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()

useSeoMeta({ title: () => t('transactions.title') })

const filters = ref<TransactionFilters>({})
// Filter-keyed page list; mutations live on the transactions store and reach
// this list via refreshNuxtData().
const { data } = useTransactions(filters)

const transactionsStore = useTransactionsStore()
const { accounts } = storeToRefs(useAccountsStore())

// Cursor pagination: `data` holds the first page (re-fetched on filter changes
// and after mutations); older pages are accumulated locally and reset whenever
// the first page changes.
const extraItems = ref<typeof data.value.items>([])
// undefined = no extra pages loaded yet; null = no more pages.
const extraCursor = ref<string | null | undefined>(undefined)
const loadingMore = ref(false)

watch(data, () => {
  extraItems.value = []
  extraCursor.value = undefined
})

const items = computed(() => [...data.value.items, ...extraItems.value])
// One row per logical operation: transfer legs collapse into a single row and
// fee rows fold into their parent (shown as "Fee …" in the subtitle).
const rows = computed(() => groupTransactionRows(items.value))
const nextCursor = computed(() => (extraCursor.value === undefined ? data.value.nextCursor : extraCursor.value))

async function loadMore() {
  const cursor = nextCursor.value
  if (!cursor || loadingMore.value) return
  loadingMore.value = true
  try {
    const page = await $fetch('/api/v1/transactions', {
      query: { limit: 50, ...filters.value, cursor },
    })
    extraItems.value = [...extraItems.value, ...page.items]
    extraCursor.value = page.nextCursor
  }
  finally {
    loadingMore.value = false
  }
}

const accountFilterItems = computed(() => [
  { label: t('transactions.allAccounts'), value: undefined },
  ...accounts.value.map(a => ({ label: a.name, value: a.id })),
])

const typeFilterItems = computed(() => [
  { label: t('transactions.allTypes'), value: undefined },
  { label: t('transactions.income'), value: 'INCOME' },
  { label: t('transactions.expense'), value: 'EXPENSE' },
])
</script>

<template>
  <UDashboardPanel id="transactions">
    <template #body>
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <USelect
            v-model="filters.accountId"
            :items="accountFilterItems"
            value-key="value"
            :placeholder="$t('transactions.allAccounts')"
            class="w-44"
          />
          <USelect
            v-model="filters.type"
            :items="typeFilterItems"
            value-key="value"
            :placeholder="$t('transactions.allTypes')"
            class="w-36"
          />
        </div>
        <div class="flex items-center gap-2">
          <UButton :label="$t('transactions.transfer')" icon="i-lucide-arrow-left-right" color="neutral" variant="subtle" @click="transactionsStore.openTransfer()" />
          <UButton :label="$t('transactions.new')" icon="i-lucide-plus" @click="transactionsStore.openCreate()" />
        </div>
      </div>

      <div v-if="rows.length" class="divide-y divide-default">
        <div
          v-for="tx in rows"
          :key="tx.id"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <UIcon
              :name="tx.transferId ? 'i-lucide-arrow-left-right' : (tx.category?.icon || (tx.type === 'INCOME' ? 'i-lucide-arrow-down-left' : 'i-lucide-arrow-up-right'))"
              class="size-5 shrink-0"
              :class="tx.transferId ? 'text-muted' : (tx.type === 'INCOME' ? 'text-success' : 'text-error')"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">
                {{ tx.transferId ? $t('transactions.transfer') : (tx.description || tx.category?.name || (tx.type === 'INCOME' ? $t('transactions.income') : $t('transactions.expense'))) }}
              </p>
              <p class="text-xs text-muted">
                <template v-if="tx.transferId">
                  {{ tx.type === 'EXPENSE' ? `${tx.account?.name} → ${tx.transferAccount}` : `${tx.transferAccount} → ${tx.account?.name}` }} · {{ formatFullDate(tx.date) }}
                </template>
                <template v-else>
                  {{ tx.account?.name }} · {{ formatFullDate(tx.date) }}
                  <span v-if="tx.category && tx.description"> · {{ tx.category.name }}</span>
                </template>
                <span v-if="Number(tx.fee) > 0"> · {{ $t('common.fee') }} {{ formatMoney(Number(tx.fee), tx.currency) }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-sm font-semibold"
              :class="tx.transferId ? 'text-highlighted' : (tx.type === 'INCOME' ? 'text-success' : 'text-error')"
            >
              {{ tx.transferPair ? '' : tx.type === 'INCOME' ? '+' : '−' }}{{ formatMoney(Number(tx.amount), tx.currency) }}
            </span>
            <UButton v-if="!tx.transferId" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="transactionsStore.openEdit(tx)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="transactionsStore.confirmDelete(tx)" />
          </div>
        </div>

        <div v-if="nextCursor" class="flex justify-center pt-4">
          <UButton
            :label="$t('common.loadMore')"
            color="neutral"
            variant="subtle"
            :loading="loadingMore"
            @click="loadMore"
          />
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-arrow-left-right" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('transactions.empty') }}
        </p>
        <UButton :label="$t('transactions.new')" icon="i-lucide-plus" @click="transactionsStore.openCreate()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
