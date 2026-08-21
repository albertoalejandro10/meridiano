<script setup lang="ts">
import { NUMBER_LOCALES } from '~/composables/useLocaleFormat'

// The exchange rate the user's own cross-currency transfers actually realised,
// one point per conversion. Not a market series — these are the rates they got.
const props = withDefaults(defineProps<{
  data: { date: string, rate: number }[]
  height?: number
}>(), {
  height: 140,
})

const { t, locale } = useI18n()
const { formatShortDate } = useLocaleFormat()

const points = computed(() => props.data.map(d => ({ date: parseDate(d.date), value: d.rate })))

const categories = computed(() => ({
  value: { name: t('analytics.moneyMovement.yourRate'), color: 'var(--ui-primary)' },
}))

const formatRate = (rate: number) =>
  new Intl.NumberFormat(NUMBER_LOCALES[locale.value], { maximumFractionDigits: 2 }).format(rate)

// Axis ticks are row indices (the library's x accessor is the index), so look
// the point up in the data instead of treating the tick as a timestamp.
const xFormatter = (tick: number | Date) => {
  const point = points.value[Math.round(Number(tick))]
  return point ? formatShortDate(point.date) : ''
}
const tooltipTitle = (row: { date: Date }) => formatShortDate(row.date)
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
