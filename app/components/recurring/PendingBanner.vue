<script setup lang="ts">
// The nudge: shown only when something is actually due, so it never becomes
// wallpaper (same rule as the task carry-over banner).
const recurringStore = useRecurringStore()
const { pending } = storeToRefs(recurringStore)
</script>

<template>
  <UAlert
    v-if="pending.length"
    icon="i-lucide-calendar-clock"
    color="primary"
    variant="subtle"
    :title="$t('recurring.pendingBanner', { count: pending.length }, pending.length)"
    :description="$t('recurring.pendingBannerHint')"
    :actions="[{ label: $t('recurring.bannerAction'), onClick: () => { recurringStore.reviewOpen = true } }]"
    class="mb-6"
  />
</template>
