<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.categories.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.categories.title')" :description="$t('settings.categories.description')">
      <SettingsPlaceholder
        icon="i-lucide-shapes"
        :title="$t('settings.categories.placeholderTitle')"
        :description="$t('settings.categories.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
