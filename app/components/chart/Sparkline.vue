<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { date: Date, value: number }[]
  height?: number
}>(), {
  height: 48,
})

const { t } = useI18n()

const trend = computed(() => {
  const first = props.data[0]?.value ?? 0
  const last = props.data[props.data.length - 1]?.value ?? 0
  return last - first
})

const categories = computed(() => ({
  value: { name: t('common.value'), color: trend.value < 0 ? 'var(--ui-error)' : 'var(--ui-success)' },
}))
</script>

<template>
  <AreaChart
    :data="data"
    :categories="categories"
    :height="height"
    x-key="date"
    hide-legend
    hide-tooltip
    hide-x-axis
    hide-y-axis
  />
</template>
