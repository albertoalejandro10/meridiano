<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatMoneyByCurrency } = useLocaleFormat()

useSeoMeta({ title: () => t('accounts.title') })

const accountsStore = useAccountsStore()
const { accounts } = storeToRefs(accountsStore)

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
</script>

<template>
  <UDashboardPanel id="accounts">
    <template #body>
      <div class="flex items-center justify-between gap-4 mb-6">
        <h1 class="text-xl font-semibold">
          {{ $t('accounts.title') }}
        </h1>
        <UButton :label="$t('accounts.modal.newAccount')" icon="i-lucide-plus" @click="accountsStore.openCreate()" />
      </div>

      <template v-if="accounts.length">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('dashboard.netWorth') }}
            </p>
            <p
              v-for="t in netWorthTotals"
              :key="t.currency"
              class="text-2xl font-semibold"
              :class="t.total < 0 ? 'text-error' : ''"
            >
              {{ formatMoney(t.total, t.currency) }}
            </p>
            <p v-if="!netWorthTotals.length" class="text-2xl font-semibold">
              {{ formatMoney(0, 'USD') }}
            </p>
          </UPageCard>
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('accounts.assets') }}
            </p>
            <p v-for="t in assetTotals" :key="t.currency" class="text-2xl font-semibold">
              {{ formatMoney(t.total, t.currency) }}
            </p>
            <p v-if="!assetTotals.length" class="text-2xl font-semibold">
              {{ formatMoney(0, 'USD') }}
            </p>
          </UPageCard>
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('accounts.debts') }}
            </p>
            <p v-for="t in debtTotals" :key="t.currency" class="text-2xl font-semibold text-error">
              {{ formatMoney(t.total, t.currency) }}
            </p>
            <p v-if="!debtTotals.length" class="text-2xl font-semibold">
              {{ formatMoney(0, 'USD') }}
            </p>
          </UPageCard>
        </div>

        <div class="space-y-6">
          <UPageCard v-for="section in sections" :key="section.key" variant="subtle">
            <template #title>
              <div class="flex items-center justify-between gap-2">
                <span>{{ section.title }}</span>
                <span class="text-sm font-semibold" :class="section.liability ? 'text-error' : ''">
                  {{ section.total }}
                </span>
              </div>
            </template>

            <div v-if="section.groups.length" class="space-y-5">
              <div v-for="group in section.groups" :key="group.type">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="flex items-center gap-2 text-sm font-medium text-muted">
                    <UIcon :name="group.icon" class="size-4" />
                    {{ group.label }}
                  </span>
                  <span class="text-sm text-muted">{{ group.subtotal }}</span>
                </div>

                <div class="divide-y divide-default rounded-lg border border-default">
                  <div
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="flex items-center justify-between gap-4 p-3"
                  >
                    <p class="text-sm font-medium truncate min-w-0">
                      {{ account.name }}
                    </p>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-sm font-semibold w-32 text-right" :class="group.liability || account.balance < 0 ? 'text-error' : ''">
                        {{ formatMoney(account.balance, account.currency) }}
                      </span>
                      <UButton v-if="isFixedValueAsset(account.type)" icon="i-lucide-tag" color="neutral" variant="ghost" size="sm" :aria-label="$t('accounts.sellNamed', { name: account.name })" @click="accountsStore.openSell(account)" />
                      <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="$t('accounts.editNamed', { name: account.name })" @click="accountsStore.openEdit(account)" />
                      <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" :aria-label="$t('accounts.deleteNamed', { name: account.name })" @click="accountsStore.confirmDelete(account)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('accounts.noneYet', { section: section.title.toLowerCase() }) }}
            </p>
          </UPageCard>

          <UPageCard v-if="archivedAccounts.length" :title="$t('accounts.archived')" variant="subtle">
            <div class="divide-y divide-default rounded-lg border border-default">
              <div
                v-for="account in archivedAccounts"
                :key="account.id"
                class="flex items-center justify-between gap-4 p-3 opacity-60"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <UIcon :name="accountTypeIcon(account.type)" class="size-4 shrink-0 text-muted" />
                  <span class="text-sm font-medium truncate">{{ account.name }}</span>
                  <UBadge :label="$t(accountTypeLabelKey(account.type))" color="neutral" variant="subtle" size="sm" />
                </span>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-sm font-semibold w-32 text-right" :class="account.balance < 0 ? 'text-error' : ''">
                    {{ formatMoney(account.balance, account.currency) }}
                  </span>
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="$t('accounts.editNamed', { name: account.name })" @click="accountsStore.openEdit(account)" />
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" :aria-label="$t('accounts.deleteNamed', { name: account.name })" @click="accountsStore.confirmDelete(account)" />
                </div>
              </div>
            </div>
          </UPageCard>
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-wallet" class="size-10 text-muted" />
        <p class="text-muted">
          {{ $t('accounts.empty') }}
        </p>
        <UButton :label="$t('accounts.modal.newAccount')" icon="i-lucide-plus" @click="accountsStore.openCreate()" />
      </div>
    </template>
  </UDashboardPanel>
</template>
