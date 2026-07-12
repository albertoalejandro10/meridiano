<script setup lang="ts">
defineProps<{ icon: string, title: string, description?: string }>()
</script>

<template>
  <UPageCard variant="subtle">
    <div class="flex flex-col items-center gap-3 py-12 text-center">
      <UIcon :name="icon" class="size-9 text-muted" />
      <p class="font-medium">
        {{ title }}
      </p>
      <p v-if="description" class="max-w-sm text-sm text-muted">
        {{ description }}
      </p>
      <UBadge :label="$t('settings.comingSoon')" color="neutral" variant="subtle" size="sm" class="mt-1" />
    </div>
  </UPageCard>
</template>
