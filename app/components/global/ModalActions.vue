<script setup lang="ts">
// The cancel/submit footer every modal form ends with. Most forms want the
// generic Save/Create pair — pass `is-edit` and the verb is derived here, so
// one place decides it. Forms with a bespoke verb ("Sell", "Transfer") pass
// `submit-label` instead.
defineProps<{
  submitLabel?: string
  isEdit?: boolean
  saving?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ cancel: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex justify-end gap-2 pt-2">
    <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="emit('cancel')" />
    <UButton
      type="submit"
      :label="submitLabel ?? (isEdit ? t('common.save') : t('common.create'))"
      :loading="saving"
      :disabled="disabled"
    />
  </div>
</template>
