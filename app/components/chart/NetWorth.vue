<script setup lang="ts">
withDefaults(defineProps<{
  data: { date: Date, value: number }[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const { t } = useI18n()
const { formatMoney, formatShortDate } = useLocaleFormat()

const categories = computed(() => ({
  value: { name: t('dashboard.netWorth'), color: 'var(--ui-primary)' },
}))

const xFormatter = (tick: number | Date) => formatShortDate(tick)
</script>

<template>
  <AreaChart
    :data="data"
    :categories="categories"
    :height="height"
    x-key="date"
    :x-formatter="xFormatter"
    :y-formatter="(tick: number) => formatMoney(tick, currency)"
    hide-legend
    :x-grid-line="false"
    :y-grid-line="false"
  />
</template>
