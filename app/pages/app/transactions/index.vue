<script setup lang="ts">
import { subDays } from 'date-fns'
import type { TransactionFilters } from '~/composables/useTransactions'
import type { CategoryPickerItem } from '~/utils/categories'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()
const { categoryLabel, groupCategoryItems } = useCategoryLabel()

useSeoMeta({ title: () => t('transactions.title') })

// The account detail page's "View all" pre-filters via ?accountId=…
const filters = ref<TransactionFilters>({
  accountId: useRoute().query.accountId as string | undefined,
})
const { data } = useTransactions(filters)

const transactionsStore = useTransactionsStore()
const { accounts } = storeToRefs(useAccountsStore())
const { data: categories } = useCategories()

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
// fee rows fold into their parent (shown as "Internal/External fee …" in the subtitle).
const rows = computed(() => groupTransactionRows(items.value))
const nextCursor = computed(() => (extraCursor.value === undefined ? data.value.nextCursor : extraCursor.value))

type Row = (typeof rows)['value'][number]

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

// The list is already ordered by date desc, so groups form from consecutive
// runs. Each day's header carries a per-currency net of its real flows —
// transfers move money around without changing it, so they're left out.
const dayGroups = computed(() => {
  const groups: { date: string, rows: Row[] }[] = []
  for (const tx of rows.value) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, rows: [] }
      groups.push(group)
    }
    group.rows.push(tx)
  }
  return groups.map(group => ({ ...group, label: dayLabel(group.date), net: dayNet(group.rows) }))
})

function dayLabel(date: string) {
  if (date === toISODate(today())) return t('common.today')
  if (date === toISODate(subDays(today(), 1))) return t('common.yesterday')
  return formatFullDate(date)
}

function dayNet(dayRows: Row[]) {
  const flows = dayRows.filter(tx => !tx.transferId)
  return sumByCurrency(flows, tx => (tx.type === 'INCOME' ? 1 : -1) * Number(tx.amount) - Number(tx.internalFee ?? 0) - Number(tx.externalFee ?? 0))
    .filter(total => total.total !== 0)
    .map(total => `${total.total > 0 ? '+' : ''}${formatMoney(total.total, total.currency)}`)
    .join(' · ')
}

function rowIcon(tx: Row) {
  if (tx.transferId) return 'i-lucide-arrow-left-right'
  return tx.category?.icon || (tx.type === 'INCOME' ? 'i-lucide-arrow-down-left' : 'i-lucide-arrow-up-right')
}

function rowTitle(tx: Row) {
  if (tx.transferId) return t('transactions.transfer')
  return tx.description || categoryLabel(tx.category) || (tx.type === 'INCOME' ? t('transactions.income') : t('transactions.expense'))
}

function rowActions(tx: Row) {
  return [
    tx.transferId ? [] : [{ label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => transactionsStore.openEdit(tx) }],
    [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => transactionsStore.confirmDelete(tx) }],
  ].filter(group => group.length)
}

const typeTab = computed({
  get: () => filters.value.type ?? 'all',
  set: (value: string) => { filters.value.type = value === 'all' ? undefined : value as 'INCOME' | 'EXPENSE' },
})

const typeFilterItems = computed(() => [
  { label: t('transactions.allTypes'), value: 'all' },
  { label: t('transactions.income'), value: 'INCOME' },
  { label: t('transactions.expense'), value: 'EXPENSE' },
])

const accountFilterItems = computed(() => [
  { label: t('transactions.allAccounts'), value: undefined },
  ...accounts.value.map(a => ({ label: a.name, value: a.id })),
])

// The "all categories" sentinel is its own group so the Income/Expense headers
// stay attached to their own options.
const categoryFilterItems = computed<CategoryPickerItem[][]>(() => [
  [{ label: t('transactions.allCategories'), value: undefined }],
  ...groupCategoryItems(categories.value ?? []),
])

// Accounts that fell behind (no transaction in over a week) — the cue for the
// batch catch-up workflow, surfaced here because this is where registering happens.
const staleAccounts = computed(() => accounts.value.filter(isStaleAccount))
const staleAlertDescription = computed(() =>
  staleAccounts.value
    .map(a => `${a.name} (${t('common.relativeDays', { n: daysSinceActivity(a) }, daysSinceActivity(a))})`)
    .join(' · '),
)

const hasActiveFilters = computed(() => Boolean(filters.value.accountId || filters.value.categoryId || filters.value.type))
function clearFilters() {
  filters.value = {}
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'transactions.title', icon: 'i-lucide-arrow-left-right', to: '/app/transactions' },
])
</script>

<template>
  <UDashboardPanel id="transactions">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('transactions.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('transactions.subtitle') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton :label="$t('transactions.transfer')" icon="i-lucide-arrow-left-right" color="neutral" variant="subtle" @click="transactionsStore.openTransfer()" />
          <UButton :label="$t('transactions.new')" icon="i-lucide-plus" @click="transactionsStore.openCreate()" />
        </div>
      </div>

      <UAlert
        v-if="staleAccounts.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock"
        class="mb-4"
        :ui="{ root: 'overflow-visible' }"
        :title="$t('transactions.staleAlert.title', { count: staleAccounts.length }, staleAccounts.length)"
        :description="staleAlertDescription"
        :actions="[{ label: $t('transactions.staleAlert.action'), to: '/app/accounts', color: 'warning', variant: 'outline', size: 'xs' }]"
      />

      <div class="flex flex-wrap items-center gap-2 mb-4">
        <UTabs v-model="typeTab" :items="typeFilterItems" size="xs" :ui="{
          root: 'gap-0'
        }" />
        <USelectMenu
          v-model="filters.accountId"
          :items="accountFilterItems"
          value-key="value"
          :placeholder="$t('transactions.allAccounts')"
          size="sm"
          class="w-44"
        />
        <USelectMenu
          v-model="filters.categoryId"
          :items="categoryFilterItems"
          value-key="value"
          :placeholder="$t('transactions.allCategories')"
          size="sm"
          class="w-44"
        />
        <UButton
          v-if="hasActiveFilters"
          :label="$t('transactions.clearFilters')"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="clearFilters"
        />
      </div>

      <template v-if="dayGroups.length">
        <div class="rounded-lg border border-default overflow-hidden shrink-0">
          <div v-for="group in dayGroups" :key="group.date" class="border-t border-default first:border-t-0">
            <div class="flex items-center justify-between gap-4 px-4 py-1.5 bg-elevated/50">
              <span class="text-xs font-medium text-muted uppercase tracking-wide">{{ group.label }}</span>
              <span v-if="group.net" class="text-xs font-medium text-muted tabular-nums">{{ group.net }}</span>
            </div>

            <div class="divide-y divide-default">
              <div
                v-for="tx in group.rows"
                :key="tx.id"
                class="flex items-center justify-between gap-4 px-4 py-3 hover:bg-elevated/30 transition-colors"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-full"
                    :class="tx.transferId ? 'bg-elevated text-muted' : (tx.type === 'INCOME' ? 'bg-success/10 text-success' : 'bg-error/10 text-error')"
                  >
                    <UIcon :name="rowIcon(tx)" class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">
                      {{ rowTitle(tx) }}
                    </p>
                    <p class="text-xs text-muted truncate">
                      <template v-if="tx.transferId">
                        {{ tx.type === 'EXPENSE' ? `${tx.account?.name} → ${tx.transferAccount}` : `${tx.transferAccount} → ${tx.account?.name}` }}
                      </template>
                      <template v-else>
                        {{ tx.account?.name }}
                        <span v-if="tx.category && tx.description"> · {{ categoryLabel(tx.category) }}</span>
                      </template>
                      <span v-if="Number(tx.internalFee) > 0"> · {{ $t('common.internalFee') }} {{ formatMoney(Number(tx.internalFee), tx.currency) }}</span>
                      <span v-if="Number(tx.externalFee) > 0"> · {{ $t('common.externalFee') }} {{ formatMoney(Number(tx.externalFee), tx.transferPair ? (tx.transferCurrency ?? tx.currency) : tx.currency) }}</span>
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <span
                    class="text-sm font-semibold tabular-nums"
                    :class="tx.transferId ? 'text-highlighted' : (tx.type === 'INCOME' ? 'text-success' : 'text-error')"
                  >
                    {{ tx.transferPair ? transferPairAmount(tx, formatMoney) : (tx.type === 'INCOME' ? '+' : '−') + formatMoney(Number(tx.amount), tx.currency) }}
                  </span>
                  <UDropdownMenu :items="rowActions(tx)">
                    <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.actions')" />
                  </UDropdownMenu>
                </div>
              </div>
            </div>
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
      </template>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <span class="flex size-14 items-center justify-center rounded-full bg-elevated">
          <UIcon name="i-lucide-arrow-left-right" class="size-6 text-muted" />
        </span>
        <p class="text-muted">
          {{ $t('transactions.empty') }}
        </p>
        <div class="flex items-center gap-2">
          <UButton
            v-if="hasActiveFilters"
            :label="$t('transactions.clearFilters')"
            icon="i-lucide-x"
            color="neutral"
            variant="subtle"
            @click="clearFilters"
          />
          <UButton :label="$t('transactions.new')" icon="i-lucide-plus" @click="transactionsStore.openCreate()" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
