<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { month: string, income: number, expenses: number }[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const { t } = useI18n()
const { formatMoney, formatMonth } = useLocaleFormat()

const categories = computed(() => ({
  income: { name: t('analytics.cashflow.income'), color: 'var(--ui-success)' },
  expenses: { name: t('analytics.cashflow.expenses'), color: 'var(--ui-error)' },
}))

// Bar charts index their ordinal x-axis, so the tick is a row index.
const xFormatter = (tick: number | Date) => {
  const month = props.data[Math.round(Number(tick))]?.month
  return month ? formatMonth(month) : ''
}
const tooltipTitle = (row: { month: string }) => formatMonth(row.month)
</script>

<template>
  <BarChart
    :data="data"
    :categories="categories"
    :height="height"
    :y-axis="['income', 'expenses']"
    x-axis="month"
    :x-formatter="xFormatter"
    :y-formatter="(tick: number) => formatMoney(tick, currency)"
    :tooltip-title-formatter="tooltipTitle"
    :radius="4"
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
