<script setup lang="ts">
// Landing page section with the shared styling and scroll-in animations for
// headline/title/description baked in — pages only provide copy and a body.
defineProps<{
  id?: string
  headline: string
  title: string
  description: string
}>()
</script>

<template>
  <UPageSection
    :id="id"
    :ui="{
      root: 'scroll-mt-(--ui-header-height)',
      container: 'max-w-5xl',
      headline: 'font-mono font-medium text-xs text-primary uppercase tracking-[0.12em] text-center',
      title: 'max-w-lg mx-auto',
      description: 'max-w-md mx-auto text-dimmed'
    }"
  >
    <template #headline>
      <Motion
        as="span"
        v-bind="scrollMotion()"
        class="inline-block"
      >
        {{ headline }}
      </Motion>
    </template>

    <template #title>
      <Motion
        as="span"
        v-bind="scrollMotion(0.1)"
        class="inline-block"
      >
        {{ title }}
      </Motion>
    </template>

    <template #description>
      <Motion
        as="span"
        v-bind="scrollMotion(0.2)"
        class="inline-block"
      >
        {{ description }}
      </Motion>
    </template>

    <slot />
  </UPageSection>
</template>
