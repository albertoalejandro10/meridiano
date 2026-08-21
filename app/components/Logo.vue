<script setup lang="ts">
// Meridiano logo: the brand mark (see app/utils/brand.ts) beside the wordmark. The mark
// is abstract rather than a letter, so the wordmark spells the name in full — the two
// are independent and either can be used alone. The mark is `fill-primary`, so it
// follows the theme via Nuxt UI's color tokens.
//
// Pass `symbol` to render just the mark (favicon, collapsed sidebar, small icon slots) —
// the full logo reuses it. Size the wordmark with a font-size class (e.g. `text-xl`);
// size the mark with a box class (e.g. `size-6`).
withDefaults(defineProps<{ symbol?: boolean }>(), { symbol: false })
</script>

<template>
  <svg
    v-if="symbol"
    :viewBox="BRAND_MARK_VIEWBOX"
    fill="none"
    role="img"
    :aria-label="BRAND_NAME"
  >
    <title>{{ BRAND_NAME }}</title>
    <path
      v-for="(d, i) in BRAND_MARK_PATHS"
      :key="i"
      :d="d"
      class="fill-primary"
    />
  </svg>

  <span
    v-else
    class="inline-flex items-center gap-[0.35em] font-extrabold tracking-tight text-highlighted"
    role="img"
    :aria-label="BRAND_NAME"
  >
    <Logo symbol aria-hidden="true" class="h-[0.9em] w-[1.02em] shrink-0" />
    <span>{{ BRAND_NAME }}</span>
  </span>
</template>
