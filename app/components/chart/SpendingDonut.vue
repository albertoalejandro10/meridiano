<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: { key: string, label: string, value: number, color: string }[]
  currency: string
  height?: number
}>(), {
  height: 250,
})

const emit = defineEmits<{ select: [index: number] }>()

const { formatMoney } = useLocaleFormat()

const categories = computed(() =>
  Object.fromEntries(props.data.map(d => [d.key, { name: d.label, color: d.color }])))

const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0))

// The library's click payload is the last-hovered tooltip data ({ label, … }),
// not a segment index — resolve the segment by its label.
function onClick(_event: MouseEvent, values?: { label?: string }) {
  const index = props.data.findIndex(d => d.label === values?.label)
  if (index >= 0) emit('select', index)
}
</script>

<template>
  <DonutChart
    :data="data.map(d => d.value)"
    :categories="categories"
    :height="height"
    :radius="4"
    :arc-width="28"
    :pad-angle="0.02"
    hide-legend
    @click="onClick"
  >
    <!-- Centered in the donut hole -->
    <p class="text-lg font-semibold text-center">
      {{ formatMoney(total, currency) }}
    </p>

    <!-- Default tooltip title-formats the whole payload object (→ NaN), so
         render the hovered segment ourselves. Inline styles: this HTML is
         cloned into the library's light-surface tooltip container. -->
    <template #tooltip="{ values }">
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0.6rem 0.75rem;">
        <span style="font-weight: 600; font-size: 0.875rem;">{{ values?.label }}</span>
        <span style="font-size: 0.875rem;">{{ formatMoney(Number(values?.[values?.label] ?? 0), currency) }}</span>
      </div>
    </template>
  </DonutChart>
</template>
