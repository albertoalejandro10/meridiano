<script setup lang="ts">
import { accountSchema, accountTypes, currencies, type AccountInput } from '~~/shared/schemas'

const props = defineProps<{
  account?: { id: string, name: string, type: string, currency: string, initialBalance: string | number, archived: boolean }
}>()

const emit = defineEmits<{ saved: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { createAccount, updateAccount } = useAccounts()

const state = reactive<AccountInput>({
  name: '',
  type: 'BANK',
  currency: 'USD',
  initialBalance: 0,
  archived: false,
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.account?.name ?? ''
  state.type = (props.account?.type as AccountInput['type']) ?? 'BANK'
  state.currency = (props.account?.currency as AccountInput['currency']) ?? 'USD'
  state.initialBalance = Number(props.account?.initialBalance ?? 0)
  state.archived = props.account?.archived ?? false
})

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    if (props.account) await updateAccount(props.account.id, { ...state })
    else await createAccount({ ...state })
    open.value = false
    emit('saved')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="account ? 'Edit account' : 'New account'">
    <template #body>
      <UForm :schema="accountSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" placeholder="e.g. Banesco, Cash USD" class="w-full" autofocus />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Type" name="type">
            <USelect v-model="state.type" :items="[...accountTypes]" class="w-full" />
          </UFormField>
          <UFormField label="Currency" name="currency">
            <USelect v-model="state.currency" :items="[...currencies]" class="w-full" :disabled="!!account" />
          </UFormField>
        </div>

        <UFormField label="Initial balance" name="initialBalance">
          <UInput v-model.number="state.initialBalance" type="number" step="0.01" class="w-full" />
        </UFormField>

        <USwitch v-if="account" v-model="state.archived" label="Archived" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="account ? 'Save' : 'Create'" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
