<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.merchants.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.merchants.title')" :description="$t('settings.merchants.description')">
      <SettingsPlaceholder
        icon="i-lucide-store"
        :title="$t('settings.merchants.placeholderTitle')"
        :description="$t('settings.merchants.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
