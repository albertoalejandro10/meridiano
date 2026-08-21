<script setup lang="ts">
import { addMonths, differenceInCalendarMonths } from 'date-fns'

const { t, locale } = useI18n()
const { formatMoney, formatMonth, formatFullDate } = useLocaleFormat()

const goalsStore = useGoalsStore()
const { goals } = storeToRefs(goalsStore)

const selectedOverride = ref<string>()
const selectedId = computed({
  get: () => (selectedOverride.value && goals.value.some(g => g.id === selectedOverride.value)
    ? selectedOverride.value
    : goals.value[0]?.id),
  set: (value: string | undefined) => { selectedOverride.value = value },
})
const goalItems = computed(() => goals.value.map(g => ({
  label: g.name,
  value: g.id,
  icon: g.icon ?? 'i-lucide-target',
})))
const goal = computed(() => goals.value.find(g => g.id === selectedId.value))

// Default the monthly amount to the pace the user is actually saving at.
const monthly = ref<number>()
watch(() => goal.value?.id, () => {
  const pace = goal.value?.recentMonthlyNet ?? 0
  monthly.value = pace > 0 ? Math.round(pace) : undefined
}, { immediate: true })

const startDate = new Date()
const sim = computed(() => goal.value
  ? simulateGoalSaving(goal.value.saved, Number(goal.value.targetAmount), Number(monthly.value) || 0, startDate)
  : null)
const projectedDate = computed(() => (sim.value?.months != null && sim.value.months > 0)
  ? addMonths(startDate, sim.value.months)
  : null)

// Early/late relative to the goal's own target date (when it has one).
const targetDelta = computed(() => {
  if (!goal.value?.targetDate || !projectedDate.value) return null
  return differenceInCalendarMonths(parseDate(goal.value.targetDate), projectedDate.value)
})

// What the target date would demand, for contrast with the number being tried.
const requiredPerMonth = computed(() => goal.value ? goalPace(goal.value).requiredPerMonth : null)

// The chart compares slopes: the amount being tried vs the actual recent pace
// vs the target date's demand, over the tried amount's horizon.
const scenarioSeries = computed(() => {
  if (!goal.value || sim.value?.months == null || sim.value.months <= 0) return []
  return simulateGoalScenarios(
    goal.value.saved,
    Number(goal.value.targetAmount),
    sim.value.months,
    { plan: Number(monthly.value) || 0, pace: goal.value.recentMonthlyNet, required: requiredPerMonth.value },
    startDate,
  )
})

const money = (n: number) => formatMoney(n, goal.value?.currency ?? 'USD')

// --- AI coaching over the scenario above ---
async function generateCoaching() {
  const result = await $fetch<{ coaching: string }>('/api/v1/ai/goal-coaching', {
    method: 'POST',
    body: {
      locale: locale.value,
      goalName: goal.value!.name,
      currency: goal.value!.currency,
      targetAmount: Number(goal.value!.targetAmount),
      saved: goal.value!.saved,
      targetDate: goal.value!.targetDate ?? null,
      monthlyTried: Number(monthly.value) || 0,
      recentMonthlyNet: goal.value!.recentMonthlyNet,
      projectedMonths: sim.value?.months ?? null,
      requiredPerMonth: requiredPerMonth.value,
    },
  })
  return result.coaching
}
</script>

<template>
  <UPageCard variant="subtle">
    <div class="mb-4">
      <p class="font-medium">
        {{ $t('planning.whatIf.title') }}
      </p>
      <p class="text-sm text-muted">
        {{ $t('planning.whatIf.description') }}
      </p>
    </div>

    <div v-if="!goals.length" class="flex flex-col items-center gap-3 py-10 text-center">
      <UIcon name="i-lucide-target" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        {{ $t('planning.whatIf.empty') }}
      </p>
      <UButton :label="$t('goals.new')" icon="i-lucide-plus" size="sm" @click="goalsStore.openCreate()" />
    </div>

    <div v-else-if="goal && sim" class="space-y-6">
      <div class="flex flex-wrap items-end gap-4">
        <UFormField :label="$t('planning.whatIf.goal')" size="sm">
          <USelectMenu v-model="selectedId" :items="goalItems" value-key="value" class="w-56" :placeholder="$t('planning.whatIf.goal')" />
        </UFormField>
        <UFormField
          :label="$t('planning.whatIf.monthlySaving')"
          :help="goal.recentMonthlyNet > 0 ? $t('planning.whatIf.currentPaceHint', { amount: money(goal.recentMonthlyNet) }) : undefined"
          size="sm"
        >
          <UInput
            v-model.number="monthly"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-40"
          />
        </UFormField>
      </div>

      <!-- already there -->
      <div v-if="sim.months === 0" class="flex items-center gap-3">
        <UIcon name="i-lucide-party-popper" class="size-5 shrink-0 text-success" />
        <p class="text-sm font-medium text-success">
          {{ $t('planning.whatIf.alreadyAchieved') }}
        </p>
      </div>

      <!-- out of reach at this pace -->
      <p v-else-if="sim.months === null" class="text-sm text-muted">
        {{ $t('planning.whatIf.noProgress') }}
      </p>

      <template v-else-if="projectedDate">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-lg font-semibold">
              {{ $t('planning.whatIf.reachOn', { goal: goal.name, date: formatMonth(projectedDate) }) }}
            </p>
            <UBadge
              v-if="targetDelta !== null"
              :label="targetDelta === 0
                ? $t('planning.whatIf.onTarget')
                : targetDelta > 0
                  ? $t('planning.whatIf.beforeTarget', { n: targetDelta }, targetDelta)
                  : $t('planning.whatIf.afterTarget', { n: -targetDelta }, -targetDelta)"
              :color="targetDelta >= 0 ? 'success' : 'warning'"
              variant="subtle"
            />
          </div>
          <p class="text-sm text-muted">
            {{ $t('planning.whatIf.inMonths', { n: sim.months }, sim.months) }}
            <template v-if="goal.targetDate && requiredPerMonth">
              · {{ $t('planning.whatIf.requiredForDate', { date: formatFullDate(goal.targetDate), amount: money(requiredPerMonth) }) }}
            </template>
          </p>
        </div>

        <ChartGoalScenarios
          :data="scenarioSeries"
          :currency="goal.currency"
        />

        <AiInsightCard
          :title="$t('planning.whatIf.coaching.title')"
          :empty-text="$t('planning.whatIf.coaching.empty')"
          :generate-label="$t('planning.whatIf.coaching.generate')"
          :regenerate-label="$t('planning.whatIf.coaching.regenerate')"
          :failed-title="$t('planning.whatIf.coaching.failed')"
          :generate="generateCoaching"
        />
      </template>
    </div>
  </UPageCard>
</template>
