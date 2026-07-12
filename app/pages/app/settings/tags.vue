<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.tags.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.tags.title')" :description="$t('settings.tags.description')">
      <SettingsPlaceholder
        icon="i-lucide-tag"
        :title="$t('settings.tags.placeholderTitle')"
        :description="$t('settings.tags.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
