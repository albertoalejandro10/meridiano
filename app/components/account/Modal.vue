<script setup lang="ts">
import { accountSchema, currencies, type AccountInput } from '~~/shared/schemas'

const { t } = useI18n()

const accountsStore = useAccountsStore()
// `editing` doubles as the mode switch: set → edit that account, unset → create.
// `modalGroup`/`modalType` scope the type picker to where the modal was opened from.
const { modalOpen: open, editing: account, modalGroup, modalType } = storeToRefs(accountsStore)
const { createAccount, updateAccount } = accountsStore

// A preset type narrows the picker to that type's group; otherwise use the context group.
// Labels are resolved here (not in accountTypeOptions) so they track the locale.
const options = computed(() =>
  accountTypeOptions(modalType.value ? accountGroup(modalType.value) : modalGroup.value)
    .map(option => ({ ...option, label: t(option.labelKey) })),
)

const state = reactive<AccountInput>({
  name: '',
  type: 'CASH',
  currency: 'USD',
  initialBalance: 0,
  archived: false,
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = account.value?.name ?? ''
  state.type = (account.value?.type as AccountInput['type']) ?? modalType.value ?? options.value[0]!.value
  state.currency = (account.value?.currency as AccountInput['currency']) ?? 'USD'
  state.initialBalance = Number(account.value?.initialBalance ?? 0)
  state.archived = account.value?.archived ?? false
})

const title = computed(() => {
  if (account.value) return t('accounts.modal.editTitle')
  if (modalType.value) return t('accounts.modal.newTyped', { type: t(accountTypeLabelKey(modalType.value)).toLowerCase() })
  if (modalGroup.value === 'asset') return t('accounts.modal.newAsset')
  if (modalGroup.value === 'liability') return t('accounts.modal.newDebt')
  return t('accounts.modal.newAccount')
})

// Liabilities are stored as positive "amount owed" — the balance formula and
// net worth subtract them, so a debt must never be entered as a negative number.
const isLiability = computed(() => accountGroup(state.type) === 'liability')
const balanceLabel = computed(() => (isLiability.value ? t('accounts.modal.amountOwed') : t('accounts.modal.initialBalance')))

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    const payload = {
      ...state,
      initialBalance: isLiability.value ? Math.abs(Number(state.initialBalance)) : state.initialBalance,
    }
    if (account.value) await updateAccount(account.value.id, payload)
    else await createAccount(payload)
    open.value = false
  }
  catch {
    // toast handled in the store; keep the modal open for another attempt
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <UForm :schema="accountSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('accounts.modal.whatToAdd')" name="type">
          <div class="grid grid-cols-3 gap-2">
            <UButton
              v-for="option in options"
              :key="option.value"
              type="button"
              :color="state.type === option.value ? 'primary' : 'neutral'"
              :variant="state.type === option.value ? 'solid' : 'outline'"
              class="flex-col items-center gap-1 h-auto py-3 text-center"
              @click="state.type = option.value"
            >
              <UIcon :name="option.icon" class="size-5" />
              <span class="text-xs leading-tight">{{ option.label }}</span>
            </UButton>
          </div>
        </UFormField>

        <UFormField :label="$t('common.name')" name="name" required>
          <UInput v-model="state.name" :placeholder="$t('accounts.modal.namePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('common.currency')" name="currency">
            <USelect v-model="state.currency" :items="[...currencies]" class="w-full" :disabled="!!account" />
          </UFormField>
          <UFormField :label="balanceLabel" name="initialBalance">
            <UInput
              v-model.number="state.initialBalance"
              type="number"
              step="0.01"
              :min="isLiability ? 0 : undefined"
              class="w-full"
            />
          </UFormField>
        </div>

        <USwitch v-if="account" v-model="state.archived" :label="$t('accounts.modal.archived')" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="account ? $t('common.save') : $t('common.create')" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
