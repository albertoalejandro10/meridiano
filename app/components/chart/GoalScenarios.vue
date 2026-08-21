<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: GoalScenarioRow[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const { t } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()

// Rows carry a series key on every row or on none (see simulateGoalScenarios),
// so the first row decides which comparison lines get drawn.
const categories = computed(() => {
  const first = props.data[0]
  return {
    plan: { name: t('planning.whatIf.series.plan'), color: 'var(--ui-primary)' },
    ...(first?.pace != null ? { pace: { name: t('planning.whatIf.series.pace'), color: 'var(--chart-2)' } } : {}),
    ...(first?.required != null ? { required: { name: t('planning.whatIf.series.required'), color: 'var(--chart-3)' } } : {}),
  }
})

// Axis ticks are row indices (the library's x accessor is the index), so look
// the date up in the data instead of treating the tick as a timestamp.
const xFormatter = (tick: number | Date) => {
  const row = props.data[Math.round(Number(tick))]
  return row ? formatMonth(row.date) : ''
}
const tooltipTitle = (row: { date: Date }) => formatMonth(row.date)
</script>

<template>
  <LineChart
    :data="data"
    :categories="categories"
    :height="height"
    x-key="date"
    :x-formatter="xFormatter"
    :y-formatter="(tick: number) => formatMoney(tick, currency)"
    :tooltip-title-formatter="tooltipTitle"
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
