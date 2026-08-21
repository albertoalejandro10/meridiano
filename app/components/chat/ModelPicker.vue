<script setup lang="ts">
import type { ChatModel } from '~~/shared/schemas'
import { chatModels } from '~~/shared/schemas'

const model = defineModel<ChatModel>({ required: true })

const items = chatModels.map(m => ({ label: m, value: m }))
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    value-key="value"
    :placeholder="$t('chat.modelPicker.placeholder')"
    class="w-44"
  />
</template>
