<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatMoneyByCurrency, formatFullDate } = useLocaleFormat()

useSeoMeta({ title: () => t('dashboard.title') })

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const { accounts } = storeToRefs(accountsStore)
const { data: txData } = storeToRefs(transactionsStore)
const { firstName } = storeToRefs(useSessionStore())

// Classify accounts by their type's group (asset vs liability).
const assets = computed(() => accounts.value.filter(a => !a.archived && accountGroup(a.type) === 'asset'))
const debts = computed(() => accounts.value.filter(a => !a.archived && accountGroup(a.type) === 'liability'))

const tab = ref('assets')
const tabItems = computed(() => [
  { label: t('dashboard.tabs.assets'), value: 'assets' },
  { label: t('dashboard.tabs.debts'), value: 'debts' },
  { label: t('dashboard.tabs.all'), value: 'all' },
])

// The active tab decides which account types the "New account" modal offers.
const newAccountGroup = computed<'asset' | 'liability' | 'all'>(() =>
  tab.value === 'assets' ? 'asset' : tab.value === 'debts' ? 'liability' : 'all',
)
const newAccountLabel = computed(() =>
  tab.value === 'assets' ? t('accounts.modal.newAsset') : tab.value === 'debts' ? t('accounts.modal.newDebt') : t('accounts.modal.newAccount'),
)

const sidePanelItems = computed(() => {
  if (tab.value === 'assets') return assets.value
  if (tab.value === 'debts') return debts.value
  return accounts.value.filter(a => !a.archived)
})

// Group the current tab's accounts by type (e.g. all Investments together) so each
// type collapses into one row, with per-currency subtotals. Order follows the catalog.
const sidePanelGroups = computed(() =>
  accountTypeOptions('all')
    .map((option) => {
      const grouped = sidePanelItems.value.filter(a => a.type === option.value)
      return {
        type: option.value,
        label: t(option.labelKey),
        icon: option.icon,
        liability: accountGroup(option.value) === 'liability',
        accounts: grouped,
        subtotal: formatMoneyByCurrency(sumByCurrency(grouped, a => a.balance)),
      }
    })
    .filter(group => group.accounts.length > 0),
)

// Amounts in different currencies are never summed — the hero number and chart
// are scoped to one currency at a time (defaulting to the most-used one).
const presentCurrencies = computed(() => {
  const counts = new Map<string, number>()
  for (const a of accounts.value) {
    if (!a.archived) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
})
const currencyOverride = ref<string>()
const currency = computed({
  get: () => (currencyOverride.value && presentCurrencies.value.includes(currencyOverride.value)
    ? currencyOverride.value
    : presentCurrencies.value[0] ?? 'USD'),
  set: (value: string) => { currencyOverride.value = value },
})
const currencyItems = computed(() => presentCurrencies.value.map(c => ({ label: c, value: c })))

// Net worth (per currency) = assets − liabilities; liability balances are
// positive amounts owed.
function netWorthOf(cur: string) {
  return accounts.value
    .filter(a => !a.archived && a.currency === cur)
    .reduce((sum, a) => sum + (accountGroup(a.type) === 'liability' ? -a.balance : a.balance), 0)
}
const netWorth = computed(() => netWorthOf(currency.value))
const otherNetWorths = computed(() =>
  presentCurrencies.value
    .filter(c => c !== currency.value)
    .map(c => formatMoney(netWorthOf(c), c))
    .join(' · '),
)

// The allocation card compares proportions, so it only makes sense within one currency.
const allocationAssets = computed(() => assets.value.filter(a => a.currency === currency.value))
const totalAssets = computed(() => allocationAssets.value.reduce((sum, a) => sum + a.balance, 0))

// Walk loaded transactions backwards from today's value to build a daily series
// (last 30 days, limited to the fetched page). For the net-worth series INCOME
// always raises net worth (on a liability it pays debt down); for a single
// liability account the sign flips, since its value is the amount owed.
function buildSeries(currentValue: number, opts: { accountId?: string, currency?: string, liability?: boolean } = {}) {
  const direction = opts.liability ? -1 : 1
  const txs = txData.value.items
    .filter(t => (!opts.accountId || t.accountId === opts.accountId)
      && (!opts.currency || t.currency === opts.currency))
    .map(t => ({
      date: parseDate(t.date),
      signed: (t.type === 'INCOME' ? 1 : -1) * direction * Number(t.amount),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const days = lastNDays(30)
  const series: { date: Date, value: number }[] = []
  let value = currentValue
  let txIndex = 0

  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!
    series.unshift({ date: day, value })
    while (txIndex < txs.length && txs[txIndex]!.date >= day) {
      value -= txs[txIndex]!.signed
      txIndex++
    }
  }
  return series
}

const netWorthSeries = computed(() => buildSeries(netWorth.value, { currency: currency.value }))

function accountSeries(account: { id: string, balance: number, type: string }) {
  return buildSeries(account.balance, {
    accountId: account.id,
    liability: accountGroup(account.type) === 'liability',
  })
}

// Pinned footer banner surfacing the newest entry — the store's base page is
// already ordered (date desc, createdAt desc), so the newest one is items[0].
// Grouped first, so a transfer reads as one operation instead of whichever of
// its legs (or its fee row) happens to sort first.
const lastTransaction = computed(() => groupTransactionRows(txData.value.items)[0])
const lastTransactionBanner = computed(() => {
  const tx = lastTransaction.value
  if (!tx) return undefined
  const name = tx.transferId
    ? t('transactions.transfer')
    : (tx.description || tx.category?.name || (tx.type === 'INCOME' ? t('transactions.income') : t('transactions.expense')))
  const where = tx.transferId
    ? (tx.type === 'EXPENSE' ? `${tx.account?.name} → ${tx.transferAccount}` : `${tx.transferAccount} → ${tx.account?.name}`)
    : tx.account?.name
  const sign = tx.transferPair ? '' : tx.type === 'INCOME' ? '+' : '−'
  return {
    icon: tx.transferId
      ? 'i-lucide-arrow-left-right'
      : (tx.type === 'INCOME' ? 'i-lucide-arrow-down-left' : 'i-lucide-arrow-up-right'),
    title: `${t('dashboard.lastTransaction')}: ${name} · ${sign}${formatMoney(Number(tx.amount), tx.currency)} · ${where} · ${formatFullDate(tx.date)}`,
  }
})

const breadcrumbItems = computed(() => [
  { label: t('dashboard.title'), icon: 'i-lucide-house', to: '/app' },
])

const sidePanelOpen = ref(true)
</script>

<template>
  <UDashboardPanel id="home">
    <template #body>
      <div class="flex gap-6">
        <div v-if="sidePanelOpen" class="w-80 shrink-0 space-y-4">
          <UTabs v-model="tab" :items="tabItems" size="sm" />

          <UButton
            :label="newAccountLabel"
            icon="i-lucide-plus"
            variant="soft"
            block
            @click="accountsStore.openCreate({ group: newAccountGroup })"
          />

          <div class="space-y-2">
            <UCollapsible
              v-for="group in sidePanelGroups"
              :key="group.type"
              class="border border-default rounded-lg"
            >
              <template #default="{ open }">
                <button class="flex items-center justify-between w-full gap-2 p-3 text-left">
                  <span class="flex items-center gap-2 min-w-0">
                    <UIcon :name="group.icon" class="size-4 shrink-0 text-muted" />
                    <span class="text-sm font-medium truncate">{{ group.label }}</span>
                    <UBadge :label="String(group.accounts.length)" color="neutral" variant="subtle" size="sm" />
                  </span>
                  <span class="flex items-center gap-2 shrink-0">
                    <span class="text-sm font-semibold" :class="group.liability ? 'text-error' : ''">
                      {{ group.subtotal }}
                    </span>
                    <UIcon
                      name="i-lucide-chevron-down"
                      class="size-4 text-muted transition-transform"
                      :class="open ? 'rotate-180' : ''"
                    />
                  </span>
                </button>
              </template>

              <template #content>
                <div class="px-3 pb-3 space-y-2">
                  <div
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="border-t border-default pt-2 first:border-t-0 first:pt-0"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm truncate">{{ account.name }}</span>
                      <div class="flex items-center gap-1 shrink-0">
                        <span class="text-sm font-medium" :class="group.liability || account.balance < 0 ? 'text-error' : ''">
                          {{ formatMoney(account.balance, account.currency) }}
                        </span>
                        <UButton
                          v-if="isFixedValueAsset(account.type)"
                          icon="i-lucide-tag"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          :aria-label="$t('accounts.sellNamed', { name: account.name })"
                          @click="accountsStore.openSell(account)"
                        />
                        <UButton
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          :aria-label="$t('accounts.deleteNamed', { name: account.name })"
                          @click="accountsStore.confirmDelete(account)"
                        />
                      </div>
                    </div>
                    <!-- Fixed-value possessions (vehicles, other assets) hold a static worth, so no trend chart. -->
                    <ChartSparkline v-if="!isFixedValueAsset(account.type)" :data="accountSeries(account)" />
                  </div>
                  <UButton
                    :label="$t('dashboard.addType', { type: group.label.toLowerCase() })"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    block
                    class="mt-1"
                    @click="accountsStore.openCreate({ group: newAccountGroup, type: group.type })"
                  />
                </div>
              </template>
            </UCollapsible>

            <p v-if="!sidePanelGroups.length" class="text-sm text-muted text-center py-6">
              {{ $t('dashboard.nothingHere') }}
            </p>
          </div>
        </div>

        <div class="flex-1 min-w-0 space-y-6">
          <div class="flex items-center gap-2">
            <UButton
              :icon="sidePanelOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="sidePanelOpen = !sidePanelOpen"
            />
            <UBreadcrumb :items="breadcrumbItems" />
          </div>

          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-xl font-semibold">
                {{ $t('dashboard.welcome', { name: firstName }) }}
              </h1>
              <p class="text-sm text-muted">
                {{ $t('dashboard.subtitle') }}
              </p>
            </div>
            <UButton :label="$t('common.new')" icon="i-lucide-plus" @click="transactionsStore.openCreate()" />
          </div>

          <UPageCard variant="subtle">
            <div class="flex items-start justify-between gap-4 mb-4">
              <div class="space-y-1">
                <p class="text-sm text-muted">
                  {{ $t('dashboard.netWorth') }}
                </p>
                <p class="text-3xl font-semibold" :class="netWorth < 0 ? 'text-error' : ''">
                  {{ formatMoney(netWorth, currency) }}
                </p>
                <p v-if="otherNetWorths" class="text-xs text-muted">
                  {{ $t('dashboard.also') }}: {{ otherNetWorths }}
                </p>
              </div>
              <UTabs
                v-if="currencyItems.length > 1"
                v-model="currency"
                :items="currencyItems"
                size="xs"
              />
            </div>
            <ChartNetWorth :data="netWorthSeries" :currency="currency" />
          </UPageCard>

          <UPageCard :title="currencyItems.length > 1 ? `${$t('dashboard.assets')} (${currency})` : $t('dashboard.assets')" variant="subtle">
            <div v-if="allocationAssets.length" class="divide-y divide-default">
              <div
                v-for="account in allocationAssets"
                :key="account.id"
                class="flex items-center justify-between gap-4 py-3"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <UIcon :name="accountTypeIcon(account.type)" class="size-5 shrink-0 text-muted" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate">
                      {{ account.name }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ $t(accountTypeLabelKey(account.type)) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                  <div class="w-24 hidden sm:block">
                    <UProgress :model-value="percentOf(account.balance, totalAssets)" size="sm" />
                  </div>
                  <span class="text-xs text-muted w-10 text-right hidden sm:block">
                    {{ formatPercent(account.balance, totalAssets) }}
                  </span>
                  <span class="text-sm font-semibold w-28 text-right">
                    {{ formatMoney(account.balance, account.currency) }}
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('dashboard.noAssets') }}
            </p>
          </UPageCard>
        </div>
      </div>
    </template>

    <!-- Pinned below the scrollable body, so it's always visible. Clicking it
         opens the full transactions list. -->
    <template #footer>
      <UBanner
        v-if="lastTransactionBanner"
        :icon="lastTransactionBanner.icon"
        :title="lastTransactionBanner.title"
        to="/app/transactions"
      />
    </template>
  </UDashboardPanel>
</template>
