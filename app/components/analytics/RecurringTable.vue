<script setup lang="ts">
export interface RecurringRow {
  name: string
  currency: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  categoryIcon: string | null
  cadence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  averageAmount: number
  lastDate: string
  nextExpectedDate: string
  occurrences: number
  monthlyEquivalent: number
  active: boolean
}

const props = defineProps<{
  items: RecurringRow[]
  currency: string
}>()

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

const showInactive = ref(false)
const visible = computed(() => props.items.filter(item => showInactive.value || item.active))
const hasInactive = computed(() => props.items.some(item => !item.active))

// The headline: what the detected active subscriptions/bills cost per month.
const monthlyTotal = computed(() =>
  props.items.filter(item => item.active).reduce((sum, item) => sum + item.monthlyEquivalent, 0))

// Detection is read-only guesswork from history. "Track this" promotes a row
// into a real template, so the app starts *asking* whether each period was paid
// instead of only noticing it afterwards.
const recurringStore = useRecurringStore()
const { templates } = storeToRefs(recurringStore)

const trackedNames = computed(() =>
  new Set(templates.value.map(template => template.description.trim().toLowerCase())))

function isTracked(item: RecurringRow) {
  return trackedNames.value.has(item.name.trim().toLowerCase())
}

function track(item: RecurringRow) {
  recurringStore.openCreate({
    description: item.name,
    cadence: item.cadence,
    // A typical charge, not the last one — a single spike shouldn't become the
    // standing estimate. The review form prefers real history anyway.
    amount: Math.round(item.averageAmount * 100) / 100,
    categoryId: item.categoryId,
    startDate: item.nextExpectedDate,
    type: 'EXPENSE',
  })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-sm text-muted">
          {{ t('analytics.recurring.monthlyTotal') }}
        </p>
        <p class="text-2xl font-semibold">
          {{ formatMoney(monthlyTotal, currency) }}
        </p>
      </div>
      <USwitch
        v-if="hasInactive"
        v-model="showInactive"
        :label="t('analytics.recurring.showInactive')"
        size="sm"
      />
    </div>

    <div v-if="visible.length" class="divide-y divide-default">
      <div
        v-for="item in visible"
        :key="`${item.currency}:${item.name}`"
        class="flex items-center justify-between gap-4 py-3"
        :class="item.active ? '' : 'opacity-60'"
      >
        <div class="flex items-center gap-3 min-w-0">
          <UIcon :name="item.categoryIcon || 'i-lucide-repeat'" class="size-5 shrink-0 text-muted" />
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ item.name }}
            </p>
            <p class="text-xs text-muted">
              {{ item.occurrences }}× · {{ categoryLabel({ slug: item.categorySlug, name: item.categoryName }) || t('analytics.spending.uncategorized') }}
              <template v-if="item.active">
                · {{ t('analytics.recurring.nextExpected') }} {{ formatFullDate(item.nextExpectedDate) }}
              </template>
              <template v-else>
                · {{ t('analytics.recurring.lastCharge') }} {{ formatFullDate(item.lastDate) }}
              </template>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <UBadge
            :label="t(`common.cadence.${item.cadence}`)"
            :color="item.active ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          />
          <div class="text-right">
            <p class="text-sm font-semibold">
              {{ formatMoney(item.averageAmount, item.currency) }}
            </p>
            <p v-if="item.cadence !== 'MONTHLY'" class="text-xs text-muted">
              ≈ {{ formatMoney(item.monthlyEquivalent, item.currency) }}/{{ t('analytics.recurring.perMonth') }}
            </p>
          </div>
          <UButton
            v-if="!isTracked(item)"
            :label="t('analytics.recurring.track')"
            icon="i-lucide-repeat"
            color="neutral"
            variant="subtle"
            size="xs"
            @click="track(item)"
          />
          <UBadge
            v-else
            :label="t('analytics.recurring.tracked')"
            icon="i-lucide-check"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-muted py-6 text-center">
      {{ t('analytics.recurring.empty') }}
    </p>
  </div>
</template>
