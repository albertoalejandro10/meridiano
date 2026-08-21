<script setup lang="ts">
import { animate, useInView } from 'motion-v'

// Counts from 0 to `value` the first time it scrolls into view. Formatting is
// delegated to the caller through the default slot's slot prop.
const props = withDefaults(defineProps<{
  value: number
  duration?: number
  delay?: number
}>(), {
  duration: 1.6,
  delay: 0
})

const el = ref<HTMLElement>()
const inView = useInView(el, { once: true, amount: 0.6 })
const current = ref(0)

watch(inView, (visible, _, onCleanup) => {
  if (!visible) return
  const controls = animate(0, props.value, {
    duration: props.duration,
    delay: props.delay,
    ease: 'easeOut',
    onUpdate: latest => (current.value = latest)
  })
  onCleanup(() => controls.stop())
})
</script>

<template>
  <span ref="el"><slot :value="current">{{ Math.round(current) }}</slot></span>
</template>
