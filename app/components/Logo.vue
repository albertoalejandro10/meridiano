<script setup lang="ts">
// BetoTracker logo: a "B" letter-mark pierced by a vertical bar so it reads as a
// currency/dollar symbol, paired with the typographic wordmark. The mark stands
// in for the "B", so the wordmark reads "eto" + "Tracker" — no redundant letter.
// The mark + "eto" use the primary/foreground colors, "Tracker" is muted — all
// theme-aware via Nuxt UI's color tokens.
//
// Pass `symbol` to render just the "$"-style "B" (favicon, collapsed sidebar,
// small icon slots) — the full logo reuses that same mark. Size the wordmark with
// a font-size class (e.g. `text-xl`); size the letter-mark with a box class (e.g.
// `size-6`).
withDefaults(defineProps<{ symbol?: boolean }>(), { symbol: false })
</script>

<template>
  <svg
    v-if="symbol"
    width="32"
    height="32"
    viewBox="0 0 48 48"
    role="img"
    aria-label="BetoTracker"
  >
    <title>BetoTracker</title>
    <text
      x="24"
      y="25"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Outfit, ui-sans-serif, system-ui, sans-serif"
      font-weight="800"
      font-size="44"
      class="fill-primary"
    >B</text>
    <rect x="22.2" y="3.5" width="3.6" height="41" rx="1.3" class="fill-primary" />
  </svg>

  <span
    v-else
    class="inline-flex items-center gap-0 font-extrabold tracking-tight text-highlighted"
    role="img"
    aria-label="BetoTracker"
  >
    <Logo symbol aria-hidden="true" class="size-[1.15em] shrink-0" />
    <!-- Pull the wordmark left to close the gap left by the mark SVG's internal
         right-side whitespace, so the "B" reads as the start of "BetoTracker". -->
    <span class="ml-[-0.15em]">eto<span class="font-medium text-muted">Tracker</span></span>
  </span>
</template>
