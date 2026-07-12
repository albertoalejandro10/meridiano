<script setup lang="ts">
const props = defineProps<{
  baseAmount: number
  currency?: string | null
}>()

const fee = defineModel<number>({ default: 0 })

const mode = ref<'fixed' | 'percent'>('fixed')
const raw = ref(fee.value || 0)

const computedFee = computed(() => {
  const value = Number(raw.value) || 0
  if (value <= 0) return 0
  return mode.value === 'percent'
    ? Math.round((Number(props.baseAmount) || 0) * value) / 100
    : Math.round(value * 100) / 100
})

watch(computedFee, value => (fee.value = value))

watch(fee, (value) => {
  if (value !== computedFee.value) {
    mode.value = 'fixed'
    raw.value = value || 0
  }
})

const modeItems = computed(() => [
  { label: currencySymbol(props.currency), value: 'fixed' },
  { label: '%', value: 'percent' },
])
</script>

<template>
  <UFieldGroup class="w-full">
    <UInput
      v-model.number="raw"
      type="number"
      step="0.01"
      min="0"
      :placeholder="mode === 'percent' ? '0' : '0.00'"
      class="w-full"
    />
    <USelect v-model="mode" :items="modeItems" value-key="value" class="w-20" />
  </UFieldGroup>
</template>
