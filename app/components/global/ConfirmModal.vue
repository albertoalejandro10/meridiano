<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

// No defaults for title/message: useConfirm() always passes both (translated
// fallbacks live there). confirmColor does default — most confirms in the app
// are destructive, and a red button on an additive action (the backup import)
// contradicts its own copy.
withDefaults(defineProps<{
  title?: string
  message?: string
  confirmColor?: ButtonProps['color']
}>(), { confirmColor: 'error' })

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
          :color="confirmColor"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
