<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { month: string, rate: number | null }[]
  height?: number
}>(), {
  height: 120,
})

const { t } = useI18n()
const { formatMonth } = useLocaleFormat()

// Months without income have no meaningful rate — skip them rather than
// plotting a misleading 0.
const points = computed(() => props.data
  .filter((d): d is { month: string, rate: number } => d.rate !== null)
  .map(d => ({ date: parseDate(`${d.month}-01`), value: d.rate })))

const categories = computed(() => ({
  value: { name: t('analytics.cashflow.savingsRate'), color: 'var(--ui-primary)' },
}))

const formatRate = (rate: number) => `${Math.round(rate * 100)}%`
// Axis ticks are row indices (the library's x accessor is the index), so look
// the month up in the data instead of treating the tick as a timestamp.
const xFormatter = (tick: number | Date) => {
  const point = points.value[Math.round(Number(tick))]
  return point ? formatMonth(point.date) : ''
}
const tooltipTitle = (row: { date: Date }) => formatMonth(row.date)
</script>

<template>
  <LineChart
    :data="points"
    :categories="categories"
    :height="height"
    x-key="date"
    :x-formatter="xFormatter"
    :y-formatter="(tick: number) => formatRate(tick)"
    :tooltip-title-formatter="tooltipTitle"
    hide-legend
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
