<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatMoneyByCurrency } = useLocaleFormat()

useSeoMeta({ title: () => t('accounts.title') })

const accountsStore = useAccountsStore()
const { accounts } = storeToRefs(accountsStore)

type Account = (typeof accounts)['value'][number]

const activeAccounts = computed(() => accounts.value.filter(a => !a.archived))
const archivedAccounts = computed(() => accounts.value.filter(a => a.archived))

// Group a list of accounts by type (catalog order), dropping empty types.
// Subtotals are per currency — amounts in different currencies are never summed.
function groupByType(list: typeof accounts.value) {
  return accountTypeOptions('all')
    .map((option) => {
      const grouped = list.filter(a => a.type === option.value)
      return {
        type: option.value,
        label: t(option.labelKey),
        icon: option.icon,
        liability: accountGroup(option.value) === 'liability',
        accounts: grouped,
        subtotal: formatMoneyByCurrency(sumByCurrency(grouped, a => a.balance)),
      }
    })
    .filter(group => group.accounts.length > 0)
}

const activeAssets = computed(() => activeAccounts.value.filter(a => accountGroup(a.type) === 'asset'))
const activeDebts = computed(() => activeAccounts.value.filter(a => accountGroup(a.type) === 'liability'))

// One entry per currency; liability balances are positive amounts owed and are
// subtracted from net worth.
const assetTotals = computed(() => sumByCurrency(activeAssets.value, a => a.balance))
const debtTotals = computed(() => sumByCurrency(activeDebts.value, a => a.balance))
const netWorthTotals = computed(() =>
  sumByCurrency(activeAccounts.value, a => (accountGroup(a.type) === 'liability' ? -a.balance : a.balance)),
)

const summaryTiles = computed(() => [
  { key: 'netWorth', label: t('dashboard.netWorth'), icon: 'i-lucide-scale', totals: netWorthTotals.value, negative: false },
  { key: 'assets', label: t('accounts.assets'), icon: 'i-lucide-trending-up', totals: assetTotals.value, negative: false },
  { key: 'debts', label: t('accounts.debts'), icon: 'i-lucide-trending-down', totals: debtTotals.value, negative: true },
])

const sections = computed(() => [
  {
    key: 'assets',
    title: t('accounts.assets'),
    liability: false,
    total: formatMoneyByCurrency(assetTotals.value),
    groups: groupByType(activeAssets.value),
  },
  {
    key: 'debts',
    title: t('accounts.liabilities'),
    liability: true,
    total: formatMoneyByCurrency(debtTotals.value),
    groups: groupByType(activeDebts.value),
  },
])

// Ellipsis menu per account card. Selling only applies to active fixed-value
// assets — archived ones already left the books; reconciling only to active
// transactable accounts (possessions have no transactions to miss).
function accountActions(account: Account) {
  return [
    [
      ...(!account.archived && canTransact(account.type)
        ? [{ label: t('accounts.reconcile.action'), icon: 'i-lucide-check-check', onSelect: () => accountsStore.openReconcile(account) }]
        : []),
      ...(!account.archived && isFixedValueAsset(account.type)
        ? [{ label: t('accounts.sell.submit'), icon: 'i-lucide-tag', onSelect: () => accountsStore.openSell(account) }]
        : []),
      { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => accountsStore.openEdit(account) },
    ],
    [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => accountsStore.confirmDelete(account) }],
  ]
}

// "Last transaction: X days ago" — the batch catch-up cue. Warning-colored via
// isStaleAccount when the account has gone quiet for over a week.
function freshnessLabel(account: Account) {
  if (!account.lastTransactionDate) return t('accounts.freshness.noTransactions')
  const n = daysSince(account.lastTransactionDate)
  return t('accounts.freshness.lastTransaction', { when: t('common.relativeDays', { n }, n) })
}

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'accounts.title', icon: 'i-lucide-wallet', to: '/app/accounts' },
])
</script>

<template>
  <UDashboardPanel id="accounts">
    <template #body>
      <UBreadcrumb :items="breadcrumbItems" class="mb-4" />

      <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $t('accounts.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('accounts.subtitle') }}
          </p>
        </div>
        <UButton :label="$t('accounts.modal.newAccount')" icon="i-lucide-plus" @click="accountsStore.openCreate()" />
      </div>

      <template v-if="accounts.length">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <UPageCard v-for="tile in summaryTiles" :key="tile.key" variant="subtle">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm text-muted">
                {{ tile.label }}
              </p>
              <UIcon :name="tile.icon" class="size-4 text-muted" />
            </div>
            <p
              v-for="total in tile.totals"
              :key="total.currency"
              class="text-2xl font-semibold tabular-nums"
              :class="tile.negative || total.total < 0 ? 'text-error' : ''"
            >
              {{ formatMoney(total.total, total.currency) }}
            </p>
            <p v-if="!tile.totals.length" class="text-2xl font-semibold tabular-nums">
              {{ formatMoney(0, 'USD') }}
            </p>
          </UPageCard>
        </div>

        <div class="space-y-8">
          <section v-for="section in sections" :key="section.key" class="space-y-4">
            <div class="flex items-baseline justify-between gap-4 border-b border-default pb-2">
              <h2 class="text-base font-semibold">
                {{ section.title }}
              </h2>
              <span class="text-sm font-semibold tabular-nums" :class="section.liability ? 'text-error' : ''">
                {{ section.total }}
              </span>
            </div>

            <div v-if="section.groups.length" class="space-y-5">
              <div v-for="group in section.groups" :key="group.type" class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2 text-sm font-medium text-muted">
                    <UIcon :name="group.icon" class="size-4" />
                    {{ group.label }}
                    <UBadge :label="String(group.accounts.length)" color="neutral" variant="subtle" size="sm" />
                  </span>
                  <span class="text-sm text-muted tabular-nums">{{ group.subtotal }}</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="relative rounded-lg border border-default p-4 hover:bg-elevated/30 transition-colors"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <span class="flex size-9 items-center justify-center rounded-full bg-elevated">
                        <UIcon :name="group.icon" class="size-4 text-muted" />
                      </span>
                      <!-- Above the stretched link, so menu clicks never navigate. -->
                      <UDropdownMenu :items="accountActions(account)" class="relative z-10">
                        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.actions')" />
                      </UDropdownMenu>
                    </div>
                    <p class="mt-3 text-sm font-medium truncate">
                      <!-- Stretched link: the whole card opens the account detail page. -->
                      <NuxtLink :to="`/app/accounts/${account.id}`" class="after:absolute after:inset-0">
                        {{ account.name }}
                      </NuxtLink>
                    </p>
                    <p class="text-xs text-muted">
                      {{ group.label }} · {{ account.currency }}
                    </p>
                    <p class="mt-2 text-lg font-semibold tabular-nums" :class="group.liability || account.balance < 0 ? 'text-error' : ''">
                      {{ formatMoney(account.balance, account.currency) }}
                    </p>
                    <template v-if="canTransact(account.type)">
                      <p class="mt-1.5 flex items-center gap-1 text-xs" :class="isStaleAccount(account) ? 'text-warning' : 'text-muted'">
                        <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
                        {{ freshnessLabel(account) }}
                      </p>
                      <p v-if="account.lastReconciliation" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <UIcon name="i-lucide-check-check" class="size-3.5 shrink-0" />
                        {{ $t('accounts.freshness.reconciled', { when: $t('common.relativeDays', { n: daysSince(account.lastReconciliation.date) }, daysSince(account.lastReconciliation.date)) }) }}
                      </p>
                      <!-- Appears and disappears with the warning: confirming resets the
                           staleness clock. Above the stretched link, so it never navigates. -->
                      <UButton
                        v-if="isStaleAccount(account)"
                        :label="$t('accounts.freshness.confirm')"
                        icon="i-lucide-check-check"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                        class="relative z-10 mt-2"
                        @click="accountsStore.confirmUpToDate(account)"
                      />
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.noneYet', { section: section.title.toLowerCase() }) }}
            </p>
          </section>

          <UCollapsible v-if="archivedAccounts.length" class="rounded-lg border border-default">
            <template #default="{ open }">
              <button type="button" class="flex w-full items-center justify-between gap-2 p-3 text-left">
                <span class="flex items-center gap-2 text-sm font-medium">
                  <UIcon name="i-lucide-archive" class="size-4 text-muted" />
                  {{ $t('accounts.archived') }}
                  <UBadge :label="String(archivedAccounts.length)" color="neutral" variant="subtle" size="sm" />
                </span>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-4 text-muted transition-transform"
                  :class="open ? 'rotate-180' : ''"
                />
              </button>
            </template>

            <template #content>
              <div class="divide-y divide-default border-t border-default">
                <div
                  v-for="account in archivedAccounts"
                  :key="account.id"
                  class="flex items-center justify-between gap-4 px-3 py-2.5 opacity-70"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <UIcon :name="accountTypeIcon(account.type)" class="size-4 shrink-0 text-muted" />
                    <NuxtLink :to="`/app/accounts/${account.id}`" class="text-sm font-medium truncate hover:underline">
                      {{ account.name }}
                    </NuxtLink>
                    <UBadge :label="$t(accountTypeLabelKey(account.type))" color="neutral" variant="subtle" size="sm" />
                  </span>
                  <div class="flex items-center gap-1 shrink-0">
                    <span class="text-sm font-semibold tabular-nums" :class="account.balance < 0 ? 'text-error' : ''">
                      {{ formatMoney(account.balance, account.currency) }}
                    </span>
                    <UDropdownMenu :items="accountActions(account)">
                      <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.actions')" />
                    </UDropdownMenu>
                  </div>
                </div>
              </div>
            </template>
          </UCollapsible>
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <span class="flex size-14 items-center justify-center rounded-full bg-elevated">
          <UIcon name="i-lucide-wallet" class="size-6 text-muted" />
        </span>
        <p class="text-muted">
          {{ $t('accounts.empty') }}
        </p>
        <UButton :label="$t('accounts.modal.newAccount')" icon="i-lucide-plus" @click="accountsStore.openCreate()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
