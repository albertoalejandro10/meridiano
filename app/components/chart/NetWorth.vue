<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { date: Date, value: number }[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const { t } = useI18n()
const { formatMoney, formatShortDate, formatFullDate } = useLocaleFormat()

const categories = computed(() => ({
  value: { name: t('dashboard.netWorth'), color: 'var(--ui-primary)' },
}))

// Axis ticks are row indices (the library's x accessor is the index), so look
// the date up in the data instead of treating the tick as a timestamp.
const xFormatter = (tick: number | Date) => {
  const row = props.data[Math.round(Number(tick))]
  return row ? formatShortDate(row.date) : ''
}
const tooltipTitle = (row: { date: Date, value: number }) => formatFullDate(row.date, 'PPPP')
</script>

<template>
  <AreaChart
    :data="data"
    :categories="categories"
    :height="height"
    x-key="date"
    :x-formatter="xFormatter"
    :y-formatter="(tick: number) => formatMoney(tick, currency)"
    :tooltip-title-formatter="tooltipTitle"
    hide-legend
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
