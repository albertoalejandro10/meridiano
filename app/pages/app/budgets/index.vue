<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

useSeoMeta({ title: () => t('budgets.title') })

const budgetsStore = useBudgetsStore()
const { budgets, incomes } = storeToRefs(budgetsStore)
const { accounts } = storeToRefs(useAccountsStore())

// Two ways to read the same allocations: per-category limits, or envelopes
// distributing an expected income. A cookie so the choice survives reloads
// (same pattern as the i18n locale).
const mode = useCookie<'category' | 'envelope'>('budget_mode', { default: () => 'category' })
const modeItems = computed(() => [
  { label: t('budgets.mode.category'), value: 'category', icon: 'i-lucide-sliders-horizontal' },
  { label: t('budgets.mode.envelope'), value: 'envelope', icon: 'i-lucide-mail' },
])

// Same rule as everywhere: amounts in different currencies are never summed —
// the page is scoped to one currency. Account currencies (usage-ordered) come
// first; budget/income-only currencies are appended so nothing set is hidden.
const presentCurrencies = computed(() => {
  const counts = new Map<string, number>()
  for (const a of accounts.value) {
    if (!a.archived) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1)
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  for (const b of budgets.value) if (!ordered.includes(b.currency)) ordered.push(b.currency)
  for (const i of incomes.value) if (!ordered.includes(i.currency)) ordered.push(i.currency)
  return ordered
})
const currencyOverride = ref<string>()
const currency = computed({
  get: () => (currencyOverride.value && presentCurrencies.value.includes(currencyOverride.value)
    ? currencyOverride.value
    : presentCurrencies.value[0] ?? 'USD'),
  set: (value: string) => { currencyOverride.value = value },
})
const currencyItems = computed(() => presentCurrencies.value.map(c => ({ label: c, value: c })))

// Limits recur monthly; the stepper only moves which month's spending is
// compared against them (same stepper as the analytics breakdown).
const currentMonth = toISODate(today()).slice(0, 7)
const month = ref(currentMonth)
const canStepForward = computed(() => month.value < currentMonth)
function stepMonth(delta: number) {
  const [year, mon] = month.value.split('-').map(Number) as [number, number]
  const d = new Date(year, mon - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "Spent" comes from the same aggregation the analytics page uses, so the two
// pages always agree on a category's monthly total.
const { data: spending } = useSpending(month)
const spentByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const r of spending.value.rows) {
    if (r.currency === currency.value && r.categoryId) map.set(r.categoryId, r.total)
  }
  return map
})

// --- Committed: tracked recurring bills this month that haven't landed yet ---
// A limit with most of it already promised to the internet bill isn't really
// "spare". Sourced from the recurring store (pending answers + upcoming due
// dates), never from a new endpoint.
const { pending, upcoming } = storeToRefs(useRecurringStore())

const isCurrentMonth = computed(() => month.value === currentMonth)

// Only for the current month: a past month's bills either landed (and are in
// `spent`) or were skipped, so a forecast there would be fiction.
const committedItems = computed(() => {
  if (!isCurrentMonth.value) return []
  return [...pending.value, ...upcoming.value].filter(item =>
    item.type === 'EXPENSE'
    && item.currency === currency.value
    && item.dueDate.startsWith(month.value))
})

const committedByCategory = computed(() => {
  const map = new Map<string, number>()
  for (const item of committedItems.value) {
    const amount = item.lastPaidAmount ?? item.estimate
    if (amount == null || !item.categoryId) continue
    map.set(item.categoryId, (map.get(item.categoryId) ?? 0) + amount)
  }
  return map
})

// Bills we can't price yet (no estimate, never paid) — flagged so the committed
// figure never reads as complete when it isn't.
const uncommittable = computed(() =>
  committedItems.value.filter(item => (item.lastPaidAmount ?? item.estimate) == null))

// One row per budget in the active currency. Colors are assigned by allocation
// size (top 8 palette slots, then gray) so the envelope bar and row dots match.
const rows = computed(() => {
  const inCurrency = budgets.value
    .filter(b => b.currency === currency.value)
    .map((b) => {
      const limit = Number(b.amount)
      const spent = spentByCategory.value.get(b.categoryId) ?? 0
      const committed = committedByCategory.value.get(b.categoryId) ?? 0
      return {
        budget: b,
        limit,
        spent,
        committed,
        pct: percentOf(spent, limit),
        // The committed bar segment sits on top of spent without overflowing.
        committedPct: Math.max(0, Math.min(percentOf(committed, limit), 100 - Math.min(percentOf(spent, limit), 100))),
        over: spent - limit,
        left: limit - spent - committed,
      }
    })
    .sort((a, b) => b.limit - a.limit)
  return inCurrency.map((r, i) => ({ ...r, color: chartColors[i] ?? chartOtherColor }))
})

const totalBudgeted = computed(() => rows.value.reduce((sum, r) => sum + r.limit, 0))
const totalSpent = computed(() => rows.value.reduce((sum, r) => sum + r.spent, 0))
const totalCommitted = computed(() => rows.value.reduce((sum, r) => sum + r.committed, 0))
const overspent = computed(() => rows.value.filter(r => r.over > 0))

function progressColor(pct: number): 'error' | 'warning' | 'primary' {
  return pct >= 100 ? 'error' : pct >= 85 ? 'warning' : 'primary'
}

// Same scale as progressColor, as a background utility — the row bar stacks
// spent and committed, which UProgress can't express with one value.
function barClass(pct: number): string {
  return pct >= 100 ? 'bg-error' : pct >= 85 ? 'bg-warning' : 'bg-primary'
}

// Spending this month in categories without a budget — the gap both modes care
// about (in zero-based budgeting every expense should live in an envelope).
const unbudgeted = computed(() => {
  const budgeted = new Set(rows.value.map(r => r.budget.categoryId))
  return spending.value.rows.filter(r =>
    r.currency === currency.value && r.total > 0 && r.categoryId && !budgeted.has(r.categoryId))
})

// --- Envelope mode: expected income and how much of it has a job ---
const income = computed(() => {
  const row = incomes.value.find(i => i.currency === currency.value)
  return row ? Number(row.amount) : null
})
const toAllocate = computed(() => (income.value ?? 0) - totalBudgeted.value)

const editingIncome = ref(false)
const incomeDraft = ref(0)
const savingIncome = ref(false)
function startEditIncome() {
  incomeDraft.value = income.value ?? 0
  editingIncome.value = true
}
async function saveIncome() {
  savingIncome.value = true
  try {
    await budgetsStore.setIncome(currency.value, incomeDraft.value > 0 ? incomeDraft.value : null)
    editingIncome.value = false
  }
  catch {
    // toast handled in the store; stay in edit mode for another attempt
  }
  finally {
    savingIncome.value = false
  }
}

// Allocation bar segments: each envelope's share of the expected income (or of
// the allocated total when it exceeds the income, so the bar never overflows).
const allocationSegments = computed(() => {
  const scale = Math.max(income.value ?? 0, totalBudgeted.value)
  return rows.value
    .filter(r => r.limit > 0)
    .map(r => ({ key: r.budget.id, color: r.color, width: percentOf(r.limit, scale) }))
})

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'budgets.title', icon: 'i-lucide-piggy-bank', to: '/app/budgets' },
])
</script>

<template>
  <UDashboardPanel id="budgets">
    <template #body>
      <div class="space-y-6">
        <UBreadcrumb :items="breadcrumbItems" />

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">
              {{ $t('budgets.title') }}
            </h1>
            <p class="text-sm text-muted">
              {{ $t('budgets.subtitle') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UTabs
              v-if="currencyItems.length > 1"
              v-model="currency"
              :items="currencyItems"
              size="xs"
            />
            <UTabs v-model="mode" :items="modeItems" size="xs" />
            <UButton :label="$t('budgets.new')" icon="i-lucide-plus" @click="budgetsStore.openCreate({ currency })" />
          </div>
        </div>

        <!-- Overspend alert (both modes: an envelope emptied is money borrowed
             from another envelope) -->
        <UAlert
          v-if="overspent.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="$t('budgets.alert.title', { count: overspent.length }, overspent.length)"
          :description="overspent.map(r => `${categoryLabel(r.budget.category)} (+${formatMoney(r.over, currency)})`).join(' · ')"
        />

        <!-- Envelope mode: expected income and allocation state -->
        <UPageCard v-if="mode === 'envelope'" variant="subtle">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-1">
              <p class="text-sm text-muted">
                {{ $t('budgets.envelope.income') }} · {{ currency }}
              </p>
              <template v-if="!editingIncome">
                <p class="text-2xl font-semibold tabular-nums">
                  {{ income !== null ? formatMoney(income, currency) : '—' }}
                </p>
                <UButton
                  :label="income !== null ? $t('common.edit') : $t('budgets.envelope.setIncome')"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-pencil"
                  @click="startEditIncome"
                />
              </template>
              <form v-else class="flex items-center gap-2" @submit.prevent="saveIncome">
                <UInput v-model.number="incomeDraft" type="number" step="0.01" min="0" class="w-36" autofocus />
                <UButton type="submit" :label="$t('common.save')" size="sm" :loading="savingIncome" />
                <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" size="sm" @click="editingIncome = false" />
              </form>
            </div>
            <div class="text-right space-y-1">
              <p class="text-sm text-muted">
                {{ $t('budgets.envelope.allocated') }}
              </p>
              <p class="text-2xl font-semibold tabular-nums">
                {{ formatMoney(totalBudgeted, currency) }}
              </p>
              <UBadge
                v-if="income !== null"
                :label="toAllocate === 0
                  ? $t('budgets.envelope.fullyAllocated')
                  : toAllocate > 0
                    ? $t('budgets.envelope.toAllocate', { amount: formatMoney(toAllocate, currency) })
                    : $t('budgets.envelope.overAllocated', { amount: formatMoney(-toAllocate, currency) })"
                :color="toAllocate === 0 ? 'success' : toAllocate > 0 ? 'warning' : 'error'"
                variant="subtle"
              />
            </div>
          </div>

          <!-- Stacked allocation bar: how the income splits across envelopes -->
          <div v-if="allocationSegments.length" class="mt-4">
            <div class="flex h-3 w-full overflow-hidden rounded-full bg-elevated">
              <div
                v-for="segment in allocationSegments"
                :key="segment.key"
                class="h-full"
                :style="{ width: `${segment.width}%`, backgroundColor: segment.color }"
              />
            </div>
          </div>
          <p v-if="income === null" class="mt-3 text-sm text-muted">
            {{ $t('budgets.envelope.noIncome') }}
          </p>
          <!-- Spend-side, so it deliberately doesn't move `toAllocate` above:
               allocation is about limits, this is about what's already promised. -->
          <p v-if="totalCommitted > 0" class="mt-3 text-sm text-muted">
            {{ $t('budgets.envelope.committed', { amount: formatMoney(totalCommitted, currency) }) }}
          </p>
        </UPageCard>

        <!-- Category-limits mode: monthly totals at a glance -->
        <div v-else-if="rows.length" class="grid grid-cols-3 gap-4">
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('budgets.summary.budgeted') }}
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ formatMoney(totalBudgeted, currency) }}
            </p>
          </UPageCard>
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('budgets.summary.spent') }}
            </p>
            <p class="text-2xl font-semibold tabular-nums">
              {{ formatMoney(totalSpent, currency) }}
            </p>
          </UPageCard>
          <UPageCard variant="subtle">
            <p class="text-sm text-muted">
              {{ $t('budgets.summary.remaining') }}
            </p>
            <p class="text-2xl font-semibold tabular-nums" :class="totalBudgeted - totalSpent < 0 ? 'text-error' : 'text-success'">
              {{ formatMoney(totalBudgeted - totalSpent, currency) }}
            </p>
            <p v-if="totalCommitted > 0" class="text-xs text-muted">
              {{ $t('budgets.summary.afterBills', { amount: formatMoney(totalBudgeted - totalSpent - totalCommitted, currency) }) }}
            </p>
          </UPageCard>
        </div>

        <!-- Budget rows: limit vs the stepped month's spending -->
        <UPageCard variant="subtle">
          <div class="flex items-center justify-between gap-4 mb-4">
            <p class="font-medium">
              {{ mode === 'envelope' ? $t('budgets.envelope.title') : $t('budgets.limits.title') }}
            </p>
            <div class="flex items-center gap-1">
              <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" :aria-label="$t('budgets.prevMonth')" @click="stepMonth(-1)" />
              <span class="text-sm font-medium w-28 text-center">{{ formatMonth(month) }}</span>
              <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" :disabled="!canStepForward" :aria-label="$t('budgets.nextMonth')" @click="stepMonth(1)" />
            </div>
          </div>

          <p v-if="uncommittable.length" class="mb-3 text-xs text-muted">
            {{ $t('budgets.row.noEstimate', { count: uncommittable.length }, uncommittable.length) }}
          </p>

          <div v-if="rows.length" class="divide-y divide-default">
            <div v-for="row in rows" :key="row.budget.id" class="py-3 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 min-w-0">
                  <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: row.color }" />
                  <UIcon v-if="row.budget.category.icon" :name="row.budget.category.icon" class="size-4 shrink-0 text-muted" />
                  <span class="text-sm font-medium truncate">{{ categoryLabel(row.budget.category) }}</span>
                  <UBadge
                    v-if="row.over > 0"
                    :label="$t('budgets.row.over', { amount: formatMoney(row.over, currency) })"
                    color="error"
                    variant="subtle"
                    size="sm"
                  />
                </span>
                <span class="flex items-center gap-1 shrink-0">
                  <span class="text-sm tabular-nums">
                    <span class="font-semibold" :class="row.over > 0 ? 'text-error' : ''">{{ formatMoney(row.spent, currency) }}</span>
                    <span class="text-muted"> / {{ formatMoney(row.limit, currency) }}</span>
                  </span>
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :aria-label="$t('common.edit')"
                    @click="budgetsStore.openEdit(row.budget)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :aria-label="$t('common.delete')"
                    @click="budgetsStore.confirmDelete(row.budget)"
                  />
                </span>
              </div>
              <div class="flex items-center gap-3">
                <!-- Solid = already spent, faded = recurring bills still to come -->
                <div class="flex h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                  <div class="h-full" :class="barClass(row.pct)" :style="{ width: `${Math.min(row.pct, 100)}%` }" />
                  <div v-if="row.committedPct > 0" class="h-full opacity-40" :class="barClass(row.pct)" :style="{ width: `${row.committedPct}%` }" />
                </div>
                <span class="text-xs text-muted w-32 text-right tabular-nums">
                  {{ row.over > 0
                    ? `${Math.round(row.pct)}%`
                    : row.committed > 0
                      ? $t('budgets.row.leftAfterBills', { amount: formatMoney(row.left, currency) })
                      : $t('budgets.row.left', { amount: formatMoney(row.limit - row.spent, currency) }) }}
                </span>
              </div>
              <p v-if="row.committed > 0" class="text-xs text-muted">
                {{ $t('budgets.row.committed', { amount: formatMoney(row.committed, currency) }) }}
              </p>
            </div>
          </div>

          <div v-else class="flex flex-col items-center gap-4 py-16 text-center">
            <UIcon name="i-lucide-piggy-bank" class="size-10 text-muted" />
            <p class="text-muted">
              {{ $t('budgets.empty') }}
            </p>
            <UButton :label="$t('budgets.new')" icon="i-lucide-plus" @click="budgetsStore.openCreate({ currency })" />
          </div>
        </UPageCard>

        <!-- Spending with no budget yet — one click to give it one -->
        <UPageCard v-if="unbudgeted.length" :title="$t('budgets.unbudgeted.title')" :description="$t('budgets.unbudgeted.description')" variant="subtle">
          <div class="divide-y divide-default">
            <div
              v-for="row in unbudgeted"
              :key="row.categoryId!"
              class="flex items-center justify-between gap-3 py-2"
            >
              <span class="flex items-center gap-2 min-w-0">
                <UIcon v-if="row.icon" :name="row.icon" class="size-4 shrink-0 text-muted" />
                <span class="text-sm truncate">{{ categoryLabel(row) || $t('analytics.spending.uncategorized') }}</span>
              </span>
              <span class="flex items-center gap-2 shrink-0">
                <span class="text-sm font-medium tabular-nums">{{ formatMoney(row.total, currency) }}</span>
                <UButton
                  :label="$t('budgets.unbudgeted.add')"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-plus"
                  @click="budgetsStore.openCreate({ categoryId: row.categoryId!, currency })"
                />
              </span>
            </div>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
