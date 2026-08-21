<script setup lang="ts">
import type { RecurringTemplate } from '~/stores/recurring'

definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatMoney, formatMoneyByCurrency, formatFullDate } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

useSeoMeta({ title: () => t('recurring.title') })

const recurringStore = useRecurringStore()
const { templates, pending, upcoming, history } = storeToRefs(recurringStore)

// What the tracked bills are expected to cost per month, per currency (amounts
// in different currencies are never summed). A template with no estimate and no
// payment history yet contributes nothing — surfaced below so the total is
// never silently understated.
const MONTHLY_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  YEARLY: 1 / 12,
}

// The most recent real amount beats the estimate — that's what the review form
// prefills with too.
const lastPaidByTemplate = computed(() => {
  const map = new Map<string, number>()
  for (const answer of history.value) {
    if (answer.status === 'PAID' && answer.amount != null && !map.has(answer.recurringId)) {
      map.set(answer.recurringId, answer.amount)
    }
  }
  return map
})

function expectedFor(template: RecurringTemplate): number | null {
  return lastPaidByTemplate.value.get(template.id) ?? template.amount
}

const activeTemplates = computed(() => templates.value.filter(tpl => tpl.enabled && !tpl.account.archived))

const monthlyTotals = computed(() =>
  formatMoneyByCurrency(sumByCurrency(
    activeTemplates.value
      .filter(tpl => tpl.type === 'EXPENSE')
      .map(tpl => ({ currency: tpl.account.currency, expected: expectedFor(tpl) ?? 0, cadence: tpl.cadence })),
    row => row.expected * (MONTHLY_FACTOR[row.cadence] ?? 1),
  )),
)

const withoutEstimate = computed(() => activeTemplates.value.filter(tpl => expectedFor(tpl) === null))

// The next handful of due dates, so "what's coming" is answerable at a glance.
const nextUp = computed(() => upcoming.value.slice(0, 8))

const breadcrumbItems = useBreadcrumbs([
  { labelKey: 'recurring.title', icon: 'i-lucide-repeat', to: '/app/recurring' },
])

function cadenceLabel(cadence: string) {
  return t(`common.cadence.${cadence}`)
}

function rowMenu(template: RecurringTemplate) {
  return [[
    { label: t('common.edit'), icon: 'i-lucide-pencil', onSelect: () => recurringStore.openEdit(template) },
    {
      label: template.enabled ? t('recurring.pause') : t('recurring.resume'),
      icon: template.enabled ? 'i-lucide-pause' : 'i-lucide-play',
      onSelect: () => recurringStore.updateRecurring(template.id, { enabled: !template.enabled }),
    },
  ], [
    { label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => recurringStore.confirmDelete(template) },
  ]]
}
</script>

<template>
  <UDashboardPanel id="recurring">
    <template #body>
      <div class="space-y-6">
        <UBreadcrumb :items="breadcrumbItems" />

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold">
              {{ $t('recurring.title') }}
            </h1>
            <p class="text-sm text-muted">
              {{ $t('recurring.subtitle') }}
            </p>
          </div>
          <UButton :label="$t('recurring.new')" icon="i-lucide-plus" @click="recurringStore.openCreate()" />
        </div>

        <RecurringPendingBanner />

        <!-- Forecast: expected monthly cost + what's due next -->
        <UPageCard v-if="activeTemplates.length" variant="subtle">
          <div class="flex flex-wrap items-start justify-between gap-6">
            <div class="space-y-1">
              <p class="text-sm text-muted">
                {{ $t('recurring.forecast.monthlyTotal') }}
              </p>
              <p class="text-2xl font-semibold tabular-nums">
                {{ monthlyTotals || '—' }}
              </p>
              <p v-if="withoutEstimate.length" class="text-xs text-muted">
                {{ $t('recurring.forecast.missingEstimate', { count: withoutEstimate.length }, withoutEstimate.length) }}
              </p>
            </div>

            <div v-if="nextUp.length" class="min-w-0 flex-1 space-y-1">
              <p class="text-sm text-muted">
                {{ $t('recurring.forecast.nextUp') }}
              </p>
              <div v-for="item in nextUp" :key="`${item.recurringId}:${item.dueDate}`" class="flex items-center justify-between gap-3 text-sm">
                <span class="min-w-0 truncate">{{ item.description }}</span>
                <span class="shrink-0 text-muted tabular-nums">
                  {{ formatFullDate(item.dueDate) }}
                  <template v-if="item.lastPaidAmount ?? item.estimate">
                    · {{ formatMoney((item.lastPaidAmount ?? item.estimate)!, item.currency) }}
                  </template>
                </span>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Templates -->
        <div v-if="templates.length" class="space-y-2">
          <h2 class="text-sm font-medium text-muted">
            {{ $t('recurring.tracked') }}
          </h2>
          <UPageCard v-for="template in templates" :key="template.id" variant="subtle" :ui="{ body: 'p-3 sm:p-4' }">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0 space-y-0.5">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-medium">
                    {{ template.description }}
                  </p>
                  <UBadge v-if="!template.enabled" :label="$t('recurring.paused')" color="neutral" variant="subtle" size="sm" />
                  <UBadge v-if="template.type === 'INCOME'" :label="$t('transactions.income')" color="success" variant="subtle" size="sm" />
                </div>
                <p class="text-xs text-muted">
                  {{ cadenceLabel(template.cadence) }} · {{ template.account.name }}
                  <template v-if="template.category"> · {{ categoryLabel(template.category) }}</template>
                  <template v-if="template.endDate"> · {{ $t('recurring.until', { date: formatFullDate(template.endDate) }) }}</template>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm tabular-nums" :class="expectedFor(template) === null ? 'text-dimmed' : ''">
                  {{ expectedFor(template) !== null
                    ? formatMoney(expectedFor(template)!, template.account.currency)
                    : $t('recurring.noEstimate') }}
                </span>
                <UDropdownMenu :items="rowMenu(template)">
                  <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" />
                </UDropdownMenu>
              </div>
            </div>
          </UPageCard>
        </div>

        <UPageCard v-else variant="subtle">
          <div class="py-8 text-center">
            <UIcon name="i-lucide-repeat" class="mx-auto size-8 text-dimmed" />
            <p class="mt-3 text-sm font-medium">
              {{ $t('recurring.empty') }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ $t('recurring.emptyHint') }}
            </p>
            <UButton class="mt-4" :label="$t('recurring.new')" icon="i-lucide-plus" @click="recurringStore.openCreate()" />
          </div>
        </UPageCard>

        <!-- Answer log: every period you've told the app about, newest first -->
        <div v-if="history.length" class="space-y-2">
          <h2 class="text-sm font-medium text-muted">
            {{ $t('recurring.history.title') }}
          </h2>
          <UPageCard variant="subtle" :ui="{ body: 'p-0 sm:p-0 divide-y divide-default' }">
            <div v-for="answer in history" :key="answer.id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm">
                  {{ answer.description }}
                </p>
                <p class="text-xs text-muted">
                  {{ formatFullDate(answer.dueDate) }}
                  <template v-if="answer.note"> · {{ answer.note }}</template>
                </p>
              </div>
              <div class="flex items-center gap-3">
                <UBadge
                  :label="answer.status === 'PAID' ? $t('recurring.review.paid') : $t('recurring.review.skipped')"
                  :color="answer.status === 'PAID' ? 'success' : 'warning'"
                  variant="subtle"
                  size="sm"
                />
                <span v-if="answer.amount != null && answer.currency" class="text-sm tabular-nums">
                  {{ formatMoney(answer.amount, answer.currency) }}
                </span>
                <UButton
                  icon="i-lucide-undo-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="$t('recurring.history.undo')"
                  @click="recurringStore.undoOccurrence(answer)"
                />
              </div>
            </div>
          </UPageCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
