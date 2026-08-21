<script setup lang="ts">
// `liabilities` arrives already negated (the API reports positive "amount
// owed"), so the stack shows debt pulling below the zero line.
const props = withDefaults(defineProps<{
  data: { date: Date, cash: number, investments: number, property: number, liabilities: number }[]
  currency: string
  height?: number
}>(), {
  height: 280,
})

const { t } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()

const categories = computed(() => ({
  cash: { name: t('analytics.netWorth.cash'), color: netWorthGroupColors.cash },
  investments: { name: t('analytics.netWorth.investments'), color: netWorthGroupColors.investments },
  property: { name: t('analytics.netWorth.property'), color: netWorthGroupColors.property },
  liabilities: { name: t('analytics.netWorth.liabilities'), color: netWorthGroupColors.liabilities },
}))

// Axis ticks are row indices (the library's x accessor is the index), so look
// the month up in the data instead of treating the tick as a timestamp.
const xFormatter = (tick: number | Date) => {
  const row = props.data[Math.round(Number(tick))]
  return row ? formatMonth(row.date) : ''
}
const tooltipTitle = (row: { date: Date }) => formatMonth(row.date)
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
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
