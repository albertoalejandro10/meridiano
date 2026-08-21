<script setup lang="ts">
import { addMonths } from 'date-fns'
import type { PayoffStrategy } from '~/utils/planning'

const { t, locale } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()

const { accounts } = storeToRefs(useAccountsStore())

// Only debts with something left to pay: liability accounts owe a positive
// derived balance (see server/utils/balances.ts).
const liabilities = computed(() => accounts.value.filter(a =>
  !a.archived && accountGroup(a.type) === 'liability' && a.balance > 0))

// Same rule as analytics: amounts in different currencies are never summed,
// so the plan is scoped to one currency at a time.
const presentCurrencies = computed(() => {
  const counts = new Map<string, number>()
  for (const a of liabilities.value) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1)
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

const debts = computed(() => liabilities.value.filter(a => a.currency === currency.value))

// APR and monthly payment aren't part of the account model — they're planner
// inputs, persisted per browser so they survive revisits.
const STORAGE_KEY = 'meridiano:planning:debt-terms'
// Pre-rebrand key. Read once so terms saved under the old brand aren't silently lost;
// the watch below rewrites them under the new key. Safe to delete once no browser can
// still be carrying it.
const LEGACY_STORAGE_KEY = 'betotrack:planning:debt-terms'
interface DebtTerms { apr?: number, payment?: number }
const terms = ref<Record<string, DebtTerms>>({})

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    terms.value = { ...JSON.parse(stored ?? '{}'), ...terms.value }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
  catch { /* corrupt storage — start fresh */ }
})
watch(terms, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

function term(id: string): DebtTerms {
  if (!terms.value[id]) terms.value[id] = {}
  return terms.value[id]!
}
watch(debts, (list) => { for (const a of list) term(a.id) }, { immediate: true })

const extraPerMonth = ref(0)
const strategy = ref<PayoffStrategy>('snowball')
const strategyItems = computed(() => [
  { label: t('planning.debt.snowball'), value: 'snowball' },
  { label: t('planning.debt.avalanche'), value: 'avalanche' },
])

const simInputs = computed(() => debts.value.map(a => ({
  id: a.id,
  balance: a.balance,
  apr: Number(term(a.id).apr) || 0,
  payment: Number(term(a.id).payment) || 0,
})))
// A plan is only meaningful once every debt has a payment committed to it.
const ready = computed(() => simInputs.value.length > 0 && simInputs.value.every(d => d.payment > 0))

const plans = computed(() => ready.value
  ? {
      snowball: simulateDebtPayoff(simInputs.value, extraPerMonth.value, 'snowball'),
      avalanche: simulateDebtPayoff(simInputs.value, extraPerMonth.value, 'avalanche'),
    }
  : null)
const chosen = computed(() => plans.value?.[strategy.value] ?? null)
const other = computed(() => plans.value?.[strategy.value === 'snowball' ? 'avalanche' : 'snowball'] ?? null)

const totalDebt = computed(() => debts.value.reduce((sum, a) => sum + a.balance, 0))
const startDate = new Date()
const debtFreeDate = computed(() => chosen.value?.paidOff ? addMonths(startDate, chosen.value.months) : null)

// Positive = the chosen strategy is cheaper than the other one.
const interestDelta = computed(() => (other.value && chosen.value && other.value.paidOff && chosen.value.paidOff)
  ? other.value.totalInterest - chosen.value.totalInterest
  : null)
const otherLabel = computed(() =>
  t(strategy.value === 'snowball' ? 'planning.debt.avalanche' : 'planning.debt.snowball'))

const chartRows = computed(() => {
  if (!plans.value) return []
  const { snowball, avalanche } = plans.value
  const length = Math.max(snowball.series.length, avalanche.series.length)
  return Array.from({ length }, (_, i) => ({
    date: addMonths(startDate, i),
    snowball: snowball.series[i] ?? 0,
    avalanche: avalanche.series[i] ?? 0,
  }))
})

const payoffList = computed(() => (chosen.value?.payoffOrder ?? []).map((entry) => {
  const account = debts.value.find(a => a.id === entry.id)
  return account ? { ...entry, name: account.name, type: account.type } : null
}).filter(entry => entry !== null))

// --- AI coaching over the plan above ---
async function generateCoaching() {
  const { snowball, avalanche } = plans.value!
  const result = await $fetch<{ coaching: string }>('/api/v1/ai/debt-coaching', {
    method: 'POST',
    body: {
      locale: locale.value,
      currency: currency.value,
      extraPerMonth: extraPerMonth.value,
      chosenStrategy: strategy.value,
      snowballPlan: { months: snowball.months, paidOff: snowball.paidOff, totalInterest: snowball.totalInterest },
      avalanchePlan: { months: avalanche.months, paidOff: avalanche.paidOff, totalInterest: avalanche.totalInterest },
      debts: debts.value.map(a => ({
        name: a.name,
        balance: a.balance,
        apr: Number(term(a.id).apr) || 0,
        payment: Number(term(a.id).payment) || 0,
      })),
    },
  })
  return result.coaching
}
</script>

<template>
  <UPageCard variant="subtle">
    <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
      <div>
        <p class="font-medium">
          {{ $t('planning.debt.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('planning.debt.description') }}
        </p>
      </div>
      <UTabs
        v-if="currencyItems.length > 1"
        v-model="currency"
        :items="currencyItems"
        size="xs"
      />
    </div>

    <div v-if="!liabilities.length" class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon name="i-lucide-party-popper" class="size-8 text-success" />
      <p class="text-sm text-muted">
        {{ $t('planning.debt.noDebts') }}
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- per-debt terms -->
      <div class="divide-y divide-default">
        <div
          v-for="account in debts"
          :key="account.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
        >
          <span class="flex size-8 items-center justify-center rounded-lg bg-accented text-muted">
            <UIcon :name="accountTypeIcon(account.type)" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ account.name }}
            </p>
            <p class="text-xs text-muted tabular-nums">
              {{ formatMoney(account.balance, account.currency) }}
            </p>
          </div>
          <UFormField :label="$t('planning.debt.apr')" size="sm">
            <UInput
              v-model.number="term(account.id).apr"
              type="number"
              step="0.1"
              min="0"
              placeholder="0.0"
              class="w-24"
            />
          </UFormField>
          <UFormField :label="$t('planning.debt.monthlyPayment')" size="sm">
            <UInput
              v-model.number="term(account.id).payment"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="w-32"
            />
          </UFormField>
        </div>
      </div>

      <!-- plan settings -->
      <div class="flex flex-wrap items-end gap-4">
        <UFormField :label="$t('planning.debt.extraPerMonth')" :help="$t('planning.debt.extraHelp')" size="sm">
          <UInput
            v-model.number="extraPerMonth"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-36"
          />
        </UFormField>
        <UFormField :label="$t('planning.debt.strategy')" size="sm">
          <UTabs v-model="strategy" :items="strategyItems" size="sm" />
        </UFormField>
        <p class="text-xs text-muted pb-1">
          {{ $t(strategy === 'snowball' ? 'planning.debt.snowballHint' : 'planning.debt.avalancheHint') }}
        </p>
      </div>

      <p v-if="!ready" class="text-sm text-muted">
        {{ $t('planning.debt.needPayments') }}
      </p>

      <UAlert
        v-else-if="chosen && !chosen.paidOff"
        color="warning"
        variant="subtle"
        icon="i-lucide-trending-up"
        :title="$t('planning.debt.neverPaysOff.title')"
        :description="$t('planning.debt.neverPaysOff.description')"
      />

      <template v-else-if="chosen && debtFreeDate">
        <!-- outcome -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p class="text-sm text-muted">
              {{ $t('planning.debt.totalDebt') }}
            </p>
            <p class="text-lg font-semibold tabular-nums">
              {{ formatMoney(totalDebt, currency) }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted">
              {{ $t('planning.debt.debtFree') }}
            </p>
            <p class="text-lg font-semibold">
              {{ formatMonth(debtFreeDate) }}
            </p>
            <p class="text-xs text-muted">
              {{ $t('planning.debt.inMonths', { n: chosen.months }, chosen.months) }}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted">
              {{ $t('planning.debt.totalInterest') }}
            </p>
            <p class="text-lg font-semibold tabular-nums">
              {{ formatMoney(chosen.totalInterest, currency) }}
            </p>
          </div>
        </div>

        <UBadge
          v-if="interestDelta !== null && Math.abs(interestDelta) >= 0.01"
          :label="interestDelta > 0
            ? $t('planning.debt.savesVs', { amount: formatMoney(interestDelta, currency), strategy: otherLabel })
            : $t('planning.debt.otherSaves', { amount: formatMoney(-interestDelta, currency), strategy: otherLabel })"
          :color="interestDelta > 0 ? 'success' : 'warning'"
          variant="subtle"
        />
        <p v-else-if="interestDelta !== null" class="text-xs text-muted">
          {{ $t('planning.debt.sameInterest') }}
        </p>

        <ChartPayoffProjection :data="chartRows" :currency="currency" />

        <!-- payoff order -->
        <div>
          <p class="mb-2 text-sm font-medium">
            {{ $t('planning.debt.payoffOrder') }}
          </p>
          <div class="divide-y divide-default">
            <div
              v-for="(entry, index) in payoffList"
              :key="entry.id"
              class="flex items-center gap-3 py-2.5"
            >
              <span class="w-5 text-sm text-muted tabular-nums">{{ index + 1 }}.</span>
              <UIcon :name="accountTypeIcon(entry.type)" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ entry.name }}</span>
              <span class="text-sm text-muted">{{ formatMonth(addMonths(startDate, entry.month)) }}</span>
            </div>
          </div>
        </div>

        <AiInsightCard
          :title="$t('planning.debt.coaching.title')"
          :empty-text="$t('planning.debt.coaching.empty')"
          :generate-label="$t('planning.debt.coaching.generate')"
          :regenerate-label="$t('planning.debt.coaching.regenerate')"
          :failed-title="$t('planning.debt.coaching.failed')"
          :generate="generateCoaching"
        />
      </template>
    </div>
  </UPageCard>
</template>
