<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number // 0..100
  color?: string | null // goal color name
  size?: number // px
  stroke?: number // stroke width px
  achieved?: boolean
}>(), {
  size: 120,
  stroke: 10,
})

const accent = computed(() => goalAccent(props.color))
const clamped = computed(() => Math.min(Math.max(props.value, 0), 100))
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dash = computed(() => (clamped.value / 100) * circumference.value)
</script>

<template>
  <div class="relative inline-flex shrink-0 items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" class="-rotate-90">
      <!-- track: the accent color faded back -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="radius"
        fill="none" :stroke-width="stroke"
        class="stroke-current opacity-20"
        :class="achieved ? 'text-success' : accent.ring"
      />
      <!-- progress arc -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="radius"
        fill="none" :stroke-width="stroke" stroke-linecap="round"
        class="stroke-current transition-[stroke-dasharray] duration-700 ease-out"
        :class="achieved ? 'text-success' : accent.ring"
        :stroke-dasharray="`${dash} ${circumference}`"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <slot>
        <span class="text-2xl font-semibold tabular-nums">{{ Math.round(clamped) }}%</span>
      </slot>
    </div>
  </div>
</template>
