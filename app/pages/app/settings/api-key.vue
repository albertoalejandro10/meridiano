<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.apiKey.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.apiKey.title')" :description="$t('settings.apiKey.description')">
      <SettingsPlaceholder
        icon="i-lucide-key"
        :title="$t('settings.apiKey.placeholderTitle')"
        :description="$t('settings.apiKey.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
