<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { date: Date, snowball: number, avalanche: number }[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const { t } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()

const categories = computed(() => ({
  snowball: { name: t('planning.debt.snowball'), color: 'var(--chart-1)' },
  avalanche: { name: t('planning.debt.avalanche'), color: 'var(--chart-2)' },
}))

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
