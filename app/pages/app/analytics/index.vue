<script setup lang="ts">
import type { ConversionRow, SpendingRow } from '~/composables/useAnalytics'
import { NUMBER_LOCALES } from '~/composables/useLocaleFormat'

definePageMeta({ layout: 'dashboard' })

const { t, locale } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()
const toast = useToast()

useSeoMeta({ title: () => t('analytics.title') })

const { accounts } = storeToRefs(useAccountsStore())

// Same rule as the dashboard: amounts in different currencies are never summed,
// so every card is scoped to one currency at a time.
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

const months = ref(12)
const rangeItems = computed(() => [3, 6, 12, 24].map(m => ({ label: t(`analytics.range.m${m}`), value: m })))

// --- AI financial digest (one-shot narrative over the sections below) ---
// The last digest is cached server-side, so arriving on this page shows what
// was already generated instead of spending another rate-limited call. Keyed by
// locale: a digest written in English isn't replayed after switching to Spanish.
const { data: cachedDigest, refresh: refreshDigest } = await useFetch<{ digest: string | null, generatedAt: string | null }>(
  '/api/v1/ai/digest',
  { key: 'aiDigest', query: { locale }, default: () => ({ digest: null, generatedAt: null }) },
)

async function generateDigest() {
  const result = await $fetch<{ digest: string }>('/api/v1/ai/digest', {
    method: 'POST',
    body: { locale: locale.value },
  })
  return result.digest
}

// Opens a chat seeded with the digest as the opening assistant turn, so the
// card becomes a conversation starter rather than a dead end. The text itself
// is read from the server's cached copy — see the route for why it isn't posted.
const startingFollowUp = ref(false)
async function askFollowUp() {
  startingFollowUp.value = true
  try {
    const conversation = await $fetch<{ id: string }>('/api/v1/ai/chat/conversations/from-digest', {
      method: 'POST',
      body: { locale: locale.value, title: t('analytics.digest.followUpTitle') },
    })
    await navigateTo(`/app/chat/${conversation.id}`)
  }
  catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    toast.add({ title: t('analytics.digest.followUpFailed'), description: e.data?.statusMessage, color: 'error' })
  }
  finally {
    startingFollowUp.value = false
  }
}

// --- Cash flow (income vs expenses + savings rate) ---
const { data: cashflow } = useCashflow(months)
const cashflowRows = computed(() => cashflow.value.rows.filter(r => r.currency === currency.value))
const totalIncome = computed(() => cashflowRows.value.reduce((sum, r) => sum + r.income, 0))
const totalExpenses = computed(() => cashflowRows.value.reduce((sum, r) => sum + r.expenses, 0))
const avgSavingsRate = computed(() =>
  totalIncome.value > 0 ? (totalIncome.value - totalExpenses.value) / totalIncome.value : null)
const savingsRateSeries = computed(() => cashflowRows.value.map(r => ({ month: r.month, rate: r.savingsRate })))
const hasCashflow = computed(() => cashflowRows.value.some(r => r.income > 0 || r.expenses > 0))

// --- Money movement (what transfers really cost) ---
// The rate a cross-currency transfer realised is implicit in the pair and is
// never stored, so it's recovered server-side; fees are attributed to the route
// that charged them. Both stay per-currency — a rate is a ratio, not a total.
const { data: moneyMovement } = useMoneyMovement(months)

const conversionPairs = computed(() => {
  const byPair = new Map<string, ConversionRow[]>()
  for (const c of moneyMovement.value.conversions) {
    // Conversions *out of* the selected currency: that's the rate the user got
    // for the money they were holding.
    if (c.sentCurrency !== currency.value) continue
    const key = `${c.sentCurrency}:${c.receivedCurrency}`
    const rows = byPair.get(key) ?? []
    rows.push(c)
    byPair.set(key, rows)
  }
  return [...byPair.entries()].map(([key, rows]) => {
    const first = rows[0]!
    const latest = rows[rows.length - 1]!
    return {
      key,
      from: first.sentCurrency,
      to: first.receivedCurrency,
      rows,
      latest,
      series: rows.map(r => ({ date: r.date, rate: r.impliedRate })),
      // Only meaningful once there are two rates to compare.
      change: rows.length > 1 && first.impliedRate > 0
        ? (latest.impliedRate - first.impliedRate) / first.impliedRate
        : null,
    }
  })
})

// Binance P2P / BCV are VES-only references, and only worth a request when the
// user actually converts into VES.
const hasVesPair = computed(() => conversionPairs.value.some(p => p.to === 'VES'))
const { data: vesRates, execute: loadVesRates } = await useFetch<{
  bcv: { rate: number, updatedAt: string } | null
  binance: { rate: number, updatedAt: string } | null
}>('/api/v1/rates/ves', { key: 'rates:ves', immediate: false, default: () => ({ bcv: null, binance: null }) })
watch(hasVesPair, (has) => { if (has) loadVesRates() }, { immediate: true })

const feeRoutes = computed(() => moneyMovement.value.fees.filter(f => f.currency === currency.value))
const feeTotal = computed(() => feeRoutes.value.reduce((sum, f) => sum + f.total, 0))
const feeDrag = computed(() => moneyMovement.value.drag.find(d => d.currency === currency.value) ?? null)
const hasMoneyMovement = computed(() => conversionPairs.value.length > 0 || feeRoutes.value.length > 0)

const formatRate = (rate: number) =>
  new Intl.NumberFormat(NUMBER_LOCALES[locale.value], { maximumFractionDigits: 2 }).format(rate)

// --- Spending breakdown + trends (one response powers both) ---
const currentMonth = toISODate(today()).slice(0, 7)
const spendingMonth = ref(currentMonth)
const canStepForward = computed(() => spendingMonth.value < currentMonth)
function stepMonth(delta: number) {
  const [year, mon] = spendingMonth.value.split('-').map(Number) as [number, number]
  const d = new Date(year, mon - 1 + delta, 1)
  spendingMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const { data: spending } = useSpending(spendingMonth)
const spendingRows = computed(() => spending.value.rows.filter(r => r.currency === currency.value))
const spendingTotal = computed(() => spendingRows.value.reduce((sum, r) => sum + r.total, 0))

interface Segment {
  key: string
  label: string
  value: number
  color: string
  row: SpendingRow | null // null = the synthetic "Other" bucket
}

// Donut slots by rank in the selected month: top 8 get palette slots in fixed
// order, everything past the 8th folds into a gray "Other" (never a 9th hue).
function toSegments(rows: SpendingRow[]): Segment[] {
  const positive = rows.filter(r => r.total > 0)
  const segments: Segment[] = positive.slice(0, 8).map((r, i) => ({
    key: r.categoryId ?? 'none',
    label: categoryLabel(r) || t('analytics.spending.uncategorized'),
    value: r.total,
    color: chartColors[i]!,
    row: r,
  }))
  const rest = positive.slice(8)
  if (rest.length) {
    segments.push({
      key: 'other',
      label: t('analytics.spending.other'),
      value: rest.reduce((sum, r) => sum + r.total, 0),
      color: chartOtherColor,
      row: null,
    })
  }
  return segments
}
const spendingSegments = computed(() => toSegments(spendingRows.value))
const spendingRest = computed(() => spendingRows.value.filter(r => r.total > 0).slice(8))
const otherExpanded = ref(false)

// MoM movement per category. prev === 0 with spending now = "new" (no ∞%).
function momDelta(row: SpendingRow): { kind: 'new' | 'pct', pct: number } | null {
  if (row.prevMonthTotal === 0) return row.total > 0 ? { kind: 'new', pct: 0 } : null
  return { kind: 'pct', pct: (row.total - row.prevMonthTotal) / row.prevMonthTotal }
}
function yoyDelta(row: SpendingRow): { kind: 'new' | 'pct', pct: number } | null {
  if (row.prevYearTotal === 0) return row.total > 0 ? { kind: 'new', pct: 0 } : null
  return { kind: 'pct', pct: (row.total - row.prevYearTotal) / row.prevYearTotal }
}
const formatDeltaPct = (pct: number) => `${pct > 0 ? '+' : ''}${Math.round(pct * 100)}%`

const trendRows = computed(() => spendingRows.value
  .filter(r => r.total > 0 || r.prevMonthTotal > 0)
  .map(r => ({ ...r, mom: momDelta(r), yoy: yoyDelta(r) }))
  .sort((a, b) => Math.abs(b.total - b.prevMonthTotal) - Math.abs(a.total - a.prevMonthTotal)))

// --- Drill-down into one category's transactions ---
const drilldownOpen = ref(false)
const drilldown = ref<{ categoryId: string | null, name: string | null, slug: string | null, type: 'INCOME' | 'EXPENSE' }>({
  categoryId: null,
  name: null,
  slug: null,
  type: 'EXPENSE',
})
function openDrilldown(row: SpendingRow, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') {
  drilldown.value = { categoryId: row.categoryId, name: row.name, slug: row.slug, type }
  drilldownOpen.value = true
}
function onSegmentSelect(segments: Segment[], index: number, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') {
  const segment = segments[index]
  if (!segment) return
  if (segment.row) openDrilldown(segment.row, type)
  else otherExpanded.value = !otherExpanded.value
}

// --- Income sources (same endpoint, INCOME side) ---
const incomeType = ref<'INCOME' | 'EXPENSE'>('INCOME')
const { data: income } = useSpending(spendingMonth, incomeType)
const incomeRows = computed(() => income.value.rows.filter(r => r.currency === currency.value))
const incomeTotal = computed(() => incomeRows.value.reduce((sum, r) => sum + r.total, 0))
const incomeSegments = computed(() => toSegments(incomeRows.value))

// --- Recurring expenses ---
const { data: recurring } = useRecurring()
const recurringItems = computed(() => recurring.value.items.filter(i => i.currency === currency.value))

// --- Net worth by account-type group ---
const { data: netWorthHistory } = useNetWorthHistory(months)
const netWorthRows = computed(() => netWorthHistory.value.rows.filter(r => r.currency === currency.value))
const netWorthSeries = computed(() => netWorthRows.value.map(r => ({
  date: parseDate(`${r.month}-01`),
  cash: r.cash,
  investments: r.investments,
  property: r.property,
  // API reports positive "amount owed"; the stack shows debt below zero.
  liabilities: -r.liabilities,
})))
const latestNetWorth = computed(() => netWorthRows.value[netWorthRows.value.length - 1]?.netWorth ?? 0)

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'analytics.title', icon: 'i-lucide-chart-pie', to: '/app/analytics' },
])
</script>

<template>
  <UDashboardPanel id="analytics">
    <template #body>
      <div class="space-y-6">
        <UBreadcrumb :items="breadcrumbItems" />

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">
              {{ $t('analytics.title') }}
            </h1>
            <p class="text-sm text-muted">
              {{ $t('analytics.subtitle') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UTabs
              v-if="currencyItems.length > 1"
              v-model="currency"
              :items="currencyItems"
              size="xs"
            />
            <USelect v-model="months" :items="rangeItems" value-key="value" size="sm" class="w-40" />
          </div>
        </div>

        <!-- 0. AI financial digest -->
        <AiInsightCard
          :title="$t('analytics.digest.title')"
          :description="$t('analytics.digest.description')"
          :empty-text="$t('analytics.digest.empty')"
          :generate-label="$t('analytics.digest.generate')"
          :regenerate-label="$t('analytics.digest.regenerate')"
          :failed-title="$t('analytics.digest.failed')"
          :generate="generateDigest"
          :initial-text="cachedDigest?.digest"
          :generated-at="cachedDigest?.generatedAt"
          @generated="refreshDigest()"
        >
          <template #meta="{ when }">
            <p class="text-xs text-muted">
              {{ $t('analytics.digest.generatedAt', { when }) }}
            </p>
          </template>
          <template #actions>
            <UButton
              :label="$t('analytics.digest.followUp')"
              icon="i-lucide-message-circle"
              color="neutral"
              variant="subtle"
              size="sm"
              :loading="startingFollowUp"
              @click="askFollowUp"
            />
          </template>
        </AiInsightCard>

        <!-- 1. Cash flow -->
        <UPageCard :title="$t('analytics.cashflow.title')" variant="subtle">
          <template v-if="hasCashflow">
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p class="text-sm text-muted">
                  {{ $t('analytics.cashflow.income') }}
                </p>
                <p class="text-lg font-semibold text-success">
                  {{ formatMoney(totalIncome, currency) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-muted">
                  {{ $t('analytics.cashflow.expenses') }}
                </p>
                <p class="text-lg font-semibold text-error">
                  {{ formatMoney(totalExpenses, currency) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-muted">
                  {{ $t('analytics.cashflow.avgSavingsRate') }}
                </p>
                <p
                  class="text-lg font-semibold"
                  :class="avgSavingsRate === null ? 'text-muted' : avgSavingsRate < 0 ? 'text-error' : 'text-success'"
                >
                  {{ avgSavingsRate === null ? '—' : `${Math.round(avgSavingsRate * 100)}%` }}
                </p>
              </div>
            </div>
            <ChartCashflow :data="cashflowRows" :currency="currency" />
            <div class="mt-4">
              <p class="text-xs text-muted mb-1">
                {{ $t('analytics.cashflow.savingsRate') }}
              </p>
              <ChartSavingsRate :data="savingsRateSeries" />
            </div>
          </template>
          <p v-else class="text-sm text-muted">
            {{ $t('analytics.cashflow.empty') }}
          </p>
        </UPageCard>

        <!-- 2. Spending breakdown -->
        <UPageCard variant="subtle">
          <div class="flex items-center justify-between gap-4 mb-4">
            <p class="font-medium">
              {{ $t('analytics.spending.title') }}
            </p>
            <div class="flex items-center gap-1">
              <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" :aria-label="$t('analytics.spending.prevMonth')" @click="stepMonth(-1)" />
              <span class="text-sm font-medium w-28 text-center">{{ formatMonth(spendingMonth) }}</span>
              <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" :disabled="!canStepForward" :aria-label="$t('analytics.spending.nextMonth')" @click="stepMonth(1)" />
            </div>
          </div>

          <div v-if="spendingSegments.length" class="grid md:grid-cols-2 gap-6 items-center">
            <ChartSpendingDonut
              :data="spendingSegments"
              :currency="currency"
              @select="onSegmentSelect(spendingSegments, $event)"
            />
            <div class="divide-y divide-default">
              <template v-for="segment in spendingSegments" :key="segment.key">
                <button
                  v-if="segment.row"
                  class="flex items-center justify-between gap-3 w-full py-2 text-left hover:bg-elevated/50 rounded-md px-2 -mx-2"
                  @click="openDrilldown(segment.row)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: segment.color }" />
                    <UIcon v-if="segment.row.icon" :name="segment.row.icon" class="size-4 shrink-0 text-muted" />
                    <span class="text-sm truncate">{{ segment.label }}</span>
                  </span>
                  <span class="flex items-center gap-2 shrink-0">
                    <UBadge
                      v-if="momDelta(segment.row)"
                      :label="momDelta(segment.row)!.kind === 'new' ? $t('analytics.trends.new') : formatDeltaPct(momDelta(segment.row)!.pct)"
                      :color="momDelta(segment.row)!.kind === 'new' ? 'neutral' : momDelta(segment.row)!.pct > 0 ? 'error' : 'success'"
                      variant="subtle"
                      size="sm"
                    />
                    <span class="text-xs text-muted w-9 text-right">{{ formatPercent(segment.value, spendingTotal) }}</span>
                    <span class="text-sm font-semibold w-24 text-right">{{ formatMoney(segment.value, currency) }}</span>
                  </span>
                </button>
                <button
                  v-else
                  class="flex items-center justify-between gap-3 w-full py-2 text-left hover:bg-elevated/50 rounded-md px-2 -mx-2"
                  @click="otherExpanded = !otherExpanded"
                >
                  <span class="flex items-center gap-2">
                    <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: segment.color }" />
                    <span class="text-sm">{{ segment.label }}</span>
                    <UIcon name="i-lucide-chevron-down" class="size-3.5 text-muted transition-transform" :class="otherExpanded ? 'rotate-180' : ''" />
                  </span>
                  <span class="flex items-center gap-2 shrink-0">
                    <span class="text-xs text-muted w-9 text-right">{{ formatPercent(segment.value, spendingTotal) }}</span>
                    <span class="text-sm font-semibold w-24 text-right">{{ formatMoney(segment.value, currency) }}</span>
                  </span>
                </button>
              </template>
              <template v-if="otherExpanded">
                <button
                  v-for="row in spendingRest"
                  :key="row.categoryId ?? 'none'"
                  class="flex items-center justify-between gap-3 w-full py-2 pl-6 text-left hover:bg-elevated/50 rounded-md px-2 -mx-2"
                  @click="openDrilldown(row)"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <UIcon v-if="row.icon" :name="row.icon" class="size-4 shrink-0 text-muted" />
                    <span class="text-sm truncate">{{ categoryLabel(row) || $t('analytics.spending.uncategorized') }}</span>
                  </span>
                  <span class="text-sm font-medium shrink-0">{{ formatMoney(row.total, currency) }}</span>
                </button>
              </template>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            {{ $t('analytics.spending.empty') }}
          </p>
        </UPageCard>

        <!-- 3. Trends (MoM / YoY per category) -->
        <UPageCard :title="$t('analytics.trends.title')" variant="subtle">
          <div v-if="trendRows.length" class="divide-y divide-default">
            <div class="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-2 text-xs text-muted">
              <span>{{ $t('analytics.trends.category') }}</span>
              <span class="w-24 text-right">{{ $t('analytics.trends.thisMonth') }}</span>
              <span class="w-20 text-right">{{ $t('analytics.trends.vsLastMonth') }}</span>
              <span class="w-20 text-right">{{ $t('analytics.trends.vsLastYear') }}</span>
            </div>
            <div
              v-for="row in trendRows"
              :key="row.categoryId ?? 'none'"
              class="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2.5"
            >
              <span class="flex items-center gap-2 min-w-0">
                <UIcon v-if="row.icon" :name="row.icon" class="size-4 shrink-0 text-muted" />
                <span class="text-sm truncate">{{ categoryLabel(row) || $t('analytics.spending.uncategorized') }}</span>
              </span>
              <span class="text-sm font-semibold w-24 text-right">{{ formatMoney(row.total, currency) }}</span>
              <span class="w-20 text-right">
                <UBadge
                  v-if="row.mom"
                  :label="row.mom.kind === 'new' ? $t('analytics.trends.new') : formatDeltaPct(row.mom.pct)"
                  :color="row.mom.kind === 'new' ? 'neutral' : row.mom.pct > 0 ? 'error' : 'success'"
                  variant="subtle"
                  size="sm"
                />
                <span v-else class="text-xs text-muted">—</span>
              </span>
              <span class="w-20 text-right">
                <UBadge
                  v-if="row.yoy && row.yoy.kind === 'pct'"
                  :label="formatDeltaPct(row.yoy.pct)"
                  :color="row.yoy.pct > 0 ? 'error' : 'success'"
                  variant="subtle"
                  size="sm"
                />
                <span v-else class="text-xs text-muted">—</span>
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            {{ $t('analytics.trends.empty') }}
          </p>
        </UPageCard>

        <!-- 4. Recurring expenses -->
        <UPageCard :title="$t('analytics.recurring.title')" :description="$t('analytics.recurring.description')" variant="subtle">
          <AnalyticsRecurringTable :items="recurringItems" :currency="currency" />
        </UPageCard>

        <!-- 5. Net worth by account type -->
        <UPageCard variant="subtle">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="space-y-1">
              <p class="font-medium">
                {{ $t('analytics.netWorth.title') }}
              </p>
              <p class="text-2xl font-semibold" :class="latestNetWorth < 0 ? 'text-error' : ''">
                {{ formatMoney(latestNetWorth, currency) }}
              </p>
            </div>
          </div>
          <ChartNetWorthStacked v-if="netWorthSeries.length" :data="netWorthSeries" :currency="currency" />
          <p v-else class="text-sm text-muted">
            {{ $t('analytics.netWorth.empty') }}
          </p>
        </UPageCard>

        <!-- 6. Income sources -->
        <UPageCard :title="$t('analytics.incomeSources.title')" variant="subtle">
          <div v-if="incomeSegments.length" class="grid md:grid-cols-2 gap-6 items-center">
            <ChartSpendingDonut
              :data="incomeSegments"
              :currency="currency"
              :height="200"
              @select="onSegmentSelect(incomeSegments, $event, 'INCOME')"
            />
            <div class="divide-y divide-default">
              <button
                v-for="segment in incomeSegments"
                :key="segment.key"
                class="flex items-center justify-between gap-3 w-full py-2 text-left hover:bg-elevated/50 rounded-md px-2 -mx-2"
                :disabled="!segment.row"
                @click="segment.row && openDrilldown(segment.row, 'INCOME')"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: segment.color }" />
                  <UIcon v-if="segment.row?.icon" :name="segment.row.icon" class="size-4 shrink-0 text-muted" />
                  <span class="text-sm truncate">{{ segment.label }}</span>
                </span>
                <span class="flex items-center gap-2 shrink-0">
                  <span class="text-xs text-muted w-9 text-right">{{ formatPercent(segment.value, incomeTotal) }}</span>
                  <span class="text-sm font-semibold w-24 text-right">{{ formatMoney(segment.value, currency) }}</span>
                </span>
              </button>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            {{ $t('analytics.incomeSources.empty') }}
          </p>
        </UPageCard>
      </div>

      <AnalyticsCategoryDrilldown
        v-model:open="drilldownOpen"
        :month="spendingMonth"
        :category-id="drilldown.categoryId"
        :category-name="drilldown.name"
        :category-slug="drilldown.slug"
        :currency="currency"
        :type="drilldown.type"
      />
    </template>
  </UDashboardPanel>
</template>
