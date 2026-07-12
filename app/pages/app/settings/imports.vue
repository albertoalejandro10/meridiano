<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()

useSeoMeta({ title: () => t('settings.imports.title') })
</script>

<template>
  <SettingsLayout>
    <SettingsSection :title="$t('settings.imports.title')" :description="$t('settings.imports.description')">
      <SettingsPlaceholder
        icon="i-lucide-download"
        :title="$t('settings.imports.placeholderTitle')"
        :description="$t('settings.imports.placeholderDescription')"
      />
    </SettingsSection>
  </SettingsLayout>
</template>
