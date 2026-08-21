<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = route.params.id as string

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const { accounts, status } = storeToRefs(accountsStore)

// No single-account endpoint exists — the account row (with its derived
// balance) comes from the app-wide accounts list.
const account = computed(() => accounts.value.find(a => a.id === id))
type Account = NonNullable<typeof account.value>

// Deleting refreshes the store before returning, which would flash the
// not-found state right before navigateTo — the leaving flag suppresses it.
const leaving = ref(false)
const notFound = computed(() => status.value === 'success' && !account.value && !leaving.value)

useSeoMeta({ title: () => account.value?.name ?? t('accounts.title') })

const isLiability = computed(() => !!account.value && accountGroup(account.value.type) === 'liability')
// Fixed-value possessions can't transact, so charts/stats/transactions would
// all be empty — they get a static "current value" view instead.
const transactable = computed(() => !!account.value && canTransact(account.value.type))

const months = ref(12)
const rangeItems = computed(() => [3, 6, 12, 24].map(m => ({ label: t(`analytics.range.m${m}`), value: m })))

const { data: stats } = useAccountStats(id, months)
const txFilters = ref({ accountId: id })
const { data: txData } = useTransactions(txFilters)

// --- Balance history ---
const balanceSeries = computed(() =>
  stats.value.balanceHistory.map(r => ({ date: parseDate(r.date), value: r.balance })))

// --- Money in/out (transfers included — on a single account a transfer leg is
// real money arriving or leaving) ---
const hasCashflow = computed(() => stats.value.cashflow.some(r => r.income > 0 || r.expenses > 0))

// --- Headline tiles ---
const statTiles = computed(() => {
  const { thisMonthIncome, thisMonthExpenses, avgMonthlyNet, transactionCount } = stats.value.totals
  const cur = account.value?.currency ?? 'USD'
  return [
    { key: 'in', label: t('accounts.detail.stats.thisMonthIn'), value: formatMoney(thisMonthIncome, cur), class: 'text-success' },
    { key: 'out', label: t('accounts.detail.stats.thisMonthOut'), value: formatMoney(thisMonthExpenses, cur), class: 'text-error' },
    { key: 'net', label: t('accounts.detail.stats.avgMonthlyNet'), value: formatMoney(avgMonthlyNet, cur), class: avgMonthlyNet < 0 ? 'text-error' : 'text-success' },
    { key: 'count', label: t('accounts.detail.stats.transactions'), value: String(transactionCount), class: '' },
  ]
})

// --- Category breakdown (expenses in the window; transfers excluded, fee rows
// count). Top 8 take palette slots in rank order, the rest fold into "Other". ---
const expenseRows = computed(() => stats.value.categories.filter(c => c.type === 'EXPENSE' && c.total > 0))
const spendingTotal = computed(() => expenseRows.value.reduce((sum, r) => sum + r.total, 0))
const spendingSegments = computed(() => {
  const segments = expenseRows.value.slice(0, 8).map((r, i) => ({
    key: r.categoryId ?? 'none',
    label: categoryLabel(r) || t('analytics.spending.uncategorized'),
    icon: r.icon,
    value: r.total,
    color: chartColors[i]!,
  }))
  const rest = expenseRows.value.slice(8)
  if (rest.length) {
    segments.push({
      key: 'other',
      label: t('analytics.spending.other'),
      icon: null,
      value: rest.reduce((sum, r) => sum + r.total, 0),
      color: chartOtherColor,
    })
  }
  return segments
})

// --- Recent transactions (transfer legs collapse, fee rows fold into parents) ---
const recentRows = computed(() => groupTransactionRows(txData.value.items).slice(0, 10))
type Row = (typeof recentRows)['value'][number]

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

// --- Header actions (same guards as the accounts list) ---
async function onDelete() {
  if (!account.value) return
  leaving.value = true
  if (await accountsStore.confirmDelete(account.value)) await navigateTo('/app/accounts')
  else leaving.value = false
}

const actionItems = computed(() => {
  const a = account.value
  if (!a) return []
  return [
    [
      ...(!a.archived && canTransact(a.type)
        ? [{ label: t('accounts.reconcile.action'), icon: 'i-lucide-check-check', onSelect: () => accountsStore.openReconcile(a) }]
        : []),
      ...(!a.archived && isFixedValueAsset(a.type)
        ? [{ label: t('accounts.sell.submit'), icon: 'i-lucide-tag', onSelect: () => accountsStore.openSell(a) }]
        : []),
      { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => accountsStore.openEdit(a) },
    ],
    [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: onDelete }],
  ]
})

function freshnessLabel(a: Account) {
  if (!a.lastTransactionDate) return t('accounts.freshness.noTransactions')
  const n = daysSince(a.lastTransactionDate)
  return t('accounts.freshness.lastTransaction', { when: t('common.relativeDays', { n }, n) })
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'accounts.title', icon: 'i-lucide-wallet', to: '/app/accounts' },
  { label: () => account.value?.name },
])
</script>

<template>
  <UDashboardPanel id="account-detail">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div v-if="notFound" class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-search-x" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('accounts.detail.notFound') }}
        </p>
        <UButton to="/app/accounts" :label="$t('accounts.detail.backToAccounts')" />
      </div>

      <div v-else-if="account" class="space-y-6">
        <!-- header -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-elevated">
              <UIcon :name="accountTypeIcon(account.type)" class="size-6 text-muted" />
            </span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="truncate text-xl font-semibold">
                  {{ account.name }}
                </h1>
                <UBadge v-if="account.archived" :label="$t('accounts.archived')" color="neutral" variant="subtle" size="sm" />
              </div>
              <p class="text-sm text-muted">
                {{ $t(accountTypeLabelKey(account.type)) }} · {{ account.currency }}
              </p>
              <template v-if="transactable">
                <p class="mt-1 flex items-center gap-1 text-xs" :class="isStaleAccount(account) ? 'text-warning' : 'text-muted'">
                  <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
                  {{ freshnessLabel(account) }}
                </p>
                <p v-if="account.lastReconciliation" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <UIcon name="i-lucide-check-check" class="size-3.5 shrink-0" />
                  {{ $t('accounts.freshness.reconciled', { when: $t('common.relativeDays', { n: daysSince(account.lastReconciliation.date) }, daysSince(account.lastReconciliation.date)) }) }}
                </p>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-right">
              <p class="text-2xl font-semibold tabular-nums" :class="isLiability || account.balance < 0 ? 'text-error' : ''">
                {{ formatMoney(account.balance, account.currency) }}
              </p>
              <p class="text-xs text-muted">
                {{ isLiability ? $t('accounts.detail.amountOwed') : $t('accounts.detail.currentBalance') }}
              </p>
            </div>
            <UButton
              v-if="transactable && !account.archived"
              :label="$t('accounts.freshness.confirm')"
              icon="i-lucide-check-check"
              color="neutral"
              variant="subtle"
              size="sm"
              @click="accountsStore.confirmUpToDate(account)"
            />
            <UDropdownMenu :items="actionItems">
              <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" :aria-label="$t('common.actions')" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Fixed-value possessions hold a static worth: no transactions, so no
             charts or lists — just the value and what to do with it. -->
        <UPageCard v-if="!transactable" variant="subtle">
          <div class="flex flex-col items-center gap-3 py-8 text-center">
            <p class="text-sm text-muted">
              {{ $t('accounts.detail.fixedValue.currentValue') }}
            </p>
            <p class="text-3xl font-semibold tabular-nums">
              {{ formatMoney(account.balance, account.currency) }}
            </p>
            <p class="text-xs text-muted">
              {{ $t('accounts.detail.fixedValue.since', { date: formatFullDate(account.createdAt) }) }}
            </p>
            <div class="mt-2 flex items-center gap-2">
              <UButton
                v-if="!account.archived && isFixedValueAsset(account.type)"
                :label="$t('accounts.sell.submit')"
                icon="i-lucide-tag"
                @click="accountsStore.openSell(account)"
              />
              <UButton :label="$t('common.edit')" icon="i-lucide-pencil" color="neutral" variant="subtle" @click="accountsStore.openEdit(account)" />
            </div>
          </div>
        </UPageCard>

        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
              <UPageCard v-for="tile in statTiles" :key="tile.key" variant="subtle" :ui="{ container: 'p-4 sm:p-4' }">
                <p class="text-xs text-muted">
                  {{ tile.label }}
                </p>
                <p class="text-lg font-semibold tabular-nums" :class="tile.class">
                  {{ tile.value }}
                </p>
              </UPageCard>
            </div>
            <USelect v-model="months" :items="rangeItems" value-key="value" size="sm" class="w-40" />
          </div>

          <!-- balance history -->
          <UPageCard :title="isLiability ? $t('accounts.detail.amountOwedHistory') : $t('accounts.detail.balanceHistory')" variant="subtle">
            <ChartNetWorth v-if="balanceSeries.length" :data="balanceSeries" :currency="account.currency" />
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.detail.cashflow.empty') }}
            </p>
          </UPageCard>

          <!-- money in / out -->
          <UPageCard :title="$t('accounts.detail.cashflow.title')" :description="$t('accounts.detail.cashflow.description')" variant="subtle">
            <ChartCashflow v-if="hasCashflow" :data="stats.cashflow" :currency="account.currency" />
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.detail.cashflow.empty') }}
            </p>
          </UPageCard>

          <!-- spending by category -->
          <UPageCard :title="$t('accounts.detail.categories.title')" variant="subtle">
            <div v-if="spendingSegments.length" class="grid items-center gap-6 md:grid-cols-2">
              <ChartSpendingDonut :data="spendingSegments" :currency="account.currency" />
              <div class="divide-y divide-default">
                <div
                  v-for="segment in spendingSegments"
                  :key="segment.key"
                  class="flex items-center justify-between gap-3 py-2"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: segment.color }" />
                    <UIcon v-if="segment.icon" :name="segment.icon" class="size-4 shrink-0 text-muted" />
                    <span class="truncate text-sm">{{ segment.label }}</span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2">
                    <span class="w-9 text-right text-xs text-muted">{{ formatPercent(segment.value, spendingTotal) }}</span>
                    <span class="w-24 text-right text-sm font-semibold tabular-nums">{{ formatMoney(segment.value, account.currency) }}</span>
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.detail.categories.empty') }}
            </p>
          </UPageCard>

          <!-- recent transactions -->
          <UPageCard variant="subtle">
            <div class="mb-3 flex items-center justify-between gap-4">
              <h3 class="font-medium">
                {{ $t('accounts.detail.recent.title') }}
              </h3>
              <UButton
                :label="$t('accounts.detail.recent.viewAll')"
                icon="i-lucide-arrow-right"
                trailing
                color="neutral"
                variant="ghost"
                size="xs"
                :to="`/app/transactions?accountId=${account.id}`"
              />
            </div>

            <div v-if="recentRows.length" class="divide-y divide-default">
              <div
                v-for="tx in recentRows"
                :key="tx.id"
                class="flex items-center justify-between gap-4 py-2.5"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-full"
                    :class="tx.transferId ? 'bg-elevated text-muted' : (tx.type === 'INCOME' ? 'bg-success/10 text-success' : 'bg-error/10 text-error')"
                  >
                    <UIcon :name="rowIcon(tx)" class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">
                      {{ rowTitle(tx) }}
                    </p>
                    <p class="truncate text-xs text-muted">
                      {{ formatFullDate(tx.date) }}
                      <template v-if="tx.transferId">
                        · {{ tx.type === 'EXPENSE' ? `${tx.account?.name} → ${tx.transferAccount}` : `${tx.transferAccount} → ${tx.account?.name}` }}
                      </template>
                      <span v-else-if="tx.category && tx.description"> · {{ categoryLabel(tx.category) }}</span>
                      <span v-if="Number(tx.internalFee) > 0"> · {{ $t('common.internalFee') }} {{ formatMoney(Number(tx.internalFee), tx.currency) }}</span>
                      <span v-if="Number(tx.externalFee) > 0"> · {{ $t('common.externalFee') }} {{ formatMoney(Number(tx.externalFee), tx.transferPair ? (tx.transferCurrency ?? tx.currency) : tx.currency) }}</span>
                    </p>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1">
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
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.detail.recent.empty') }}
            </p>
          </UPageCard>

          <!-- reconciliation history -->
          <UPageCard variant="subtle">
            <div class="mb-3 flex items-center justify-between gap-4">
              <h3 class="font-medium">
                {{ $t('accounts.detail.reconciliations.title') }}
              </h3>
              <div v-if="!account.archived" class="flex items-center gap-2">
                <UButton
                  :label="$t('accounts.freshness.confirm')"
                  icon="i-lucide-check-check"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  @click="accountsStore.confirmUpToDate(account)"
                />
                <UButton
                  :label="$t('accounts.reconcile.action')"
                  icon="i-lucide-scale"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="accountsStore.openReconcile(account)"
                />
              </div>
            </div>

            <div v-if="stats.reconciliations.length" class="divide-y divide-default">
              <div
                v-for="r in stats.reconciliations"
                :key="`${r.date}:${r.statedBalance}`"
                class="flex items-center justify-between gap-4 py-2"
              >
                <span class="flex items-center gap-2 text-sm">
                  <UIcon name="i-lucide-check-check" class="size-4 text-muted" />
                  {{ formatFullDate(r.date) }}
                </span>
                <span class="text-sm font-medium tabular-nums">{{ formatMoney(r.statedBalance, account.currency) }}</span>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.detail.reconciliations.empty') }}
            </p>
          </UPageCard>
        </template>
      </div>

      <div v-else class="flex justify-center py-24">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>
    </template>
  </UDashboardPanel>
</template>
