<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

// setLocale swaps the messages in place and persists the choice in the i18n cookie.
const items = computed(() => locales.value.map(l => ({
  label: l.name ?? l.code,
  type: 'checkbox' as const,
  checked: locale.value === l.code,
  onSelect: () => { setLocale(l.code) }
})))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      icon="i-lucide-languages"
      color="neutral"
      variant="ghost"
      square
      :aria-label="$t('settings.preferences.language')"
    />
  </UDropdownMenu>
</template>
