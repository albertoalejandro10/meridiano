<script setup lang="ts">
// No prop defaults: useConfirm() always passes both (translated fallbacks live there).
defineProps<{
  title?: string
  message?: string
}>()

const emit = defineEmits<{ close: [boolean] }>()
</script>

<template>
  <UModal
    :title="title"
    :close="{ onClick: () => emit('close', false) }"
    :dismissible="false"
  >
    <template #body>
      <p class="text-sm text-muted">
        {{ message }}
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          :label="$t('common.cancel')"
          color="neutral"
          variant="ghost"
          @click="emit('close', false)"
        />
        <UButton
          :label="$t('confirm.confirm')"
          color="error"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
