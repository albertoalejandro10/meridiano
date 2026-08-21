<script setup lang="ts">
import { cadences, recurringSchema, type Cadence, type TransactionType } from '~~/shared/schemas'

const { t } = useI18n()
const { categoryLabel, sortCategories } = useCategoryLabel()

const recurringStore = useRecurringStore()
// `editing` doubles as the mode switch: with an id → edit, without → create
// (possibly prefilled from the analytics "track this" shortcut).
const { modalOpen: open, editing: template } = storeToRefs(recurringStore)
const { createRecurring, updateRecurring } = recurringStore

const isEdit = computed(() => !!(template.value && 'id' in template.value && template.value.id))

const { accounts } = storeToRefs(useAccountsStore())
const { data: categories } = useCategories()

const state = reactive({
  description: '',
  type: 'EXPENSE' as TransactionType,
  accountId: undefined as string | undefined,
  categoryId: null as string | null,
  cadence: 'MONTHLY' as Cadence,
  // Optional: leaving it empty means "I have no guess, ask me every time".
  amount: undefined as number | undefined,
  startDate: toISODate(today()),
  endDate: '' as string,
  enabled: true,
})

const typeItems = computed(() => [
  { label: t('transactions.expense'), value: 'EXPENSE' },
  { label: t('transactions.income'), value: 'INCOME' },
])

const cadenceItems = computed(() =>
  cadences.map(c => ({ label: t(`common.cadence.${c}`), value: c })),
)

// Same filter as the transaction modal: only accounts you can transact on, and
// never a stale archived one (keeping the current selection so editing a
// template on an archived account doesn't silently blank the field).
const accountItems = computed(() =>
  accounts.value
    .filter(a => canTransact(a.type) && (!a.archived || a.id === state.accountId))
    .map(a => ({ label: `${a.name} (${a.currency})`, value: a.id })),
)

const categoryItems = computed(() => [
  { label: t('transactions.modal.noCategory'), value: null },
  ...sortCategories((categories.value ?? []).filter(c => !c.type || c.type === state.type))
    .map(c => ({ label: categoryLabel(c), value: c.id, icon: c.icon ?? undefined })),
])

const { saving, submit } = useModalForm(open, () => {
  const editingTemplate = template.value
  state.description = editingTemplate?.description ?? ''
  state.type = editingTemplate?.type ?? 'EXPENSE'
  state.accountId = editingTemplate?.accountId ?? accountItems.value[0]?.value
  state.categoryId = editingTemplate?.categoryId ?? null
  state.cadence = editingTemplate?.cadence ?? 'MONTHLY'
  state.amount = editingTemplate?.amount ?? undefined
  state.startDate = editingTemplate?.startDate ?? toISODate(today())
  state.endDate = (editingTemplate && 'endDate' in editingTemplate ? editingTemplate.endDate : null) ?? ''
  state.enabled = (editingTemplate && 'enabled' in editingTemplate ? editingTemplate.enabled : null) ?? true
})

// Switching type invalidates a category typed the other way (same guard the
// transaction modal uses).
watch(() => state.type, () => {
  const picked = (categories.value ?? []).find(c => c.id === state.categoryId)
  if (picked?.type && picked.type !== state.type) state.categoryId = null
})

const onSubmit = () => submit(() => {
  const payload = {
    description: state.description,
    type: state.type,
    accountId: state.accountId!,
    categoryId: state.categoryId,
    cadence: state.cadence,
    amount: state.amount ?? null,
    startDate: new Date(state.startDate),
    endDate: state.endDate ? new Date(state.endDate) : null,
    enabled: state.enabled,
  }
  return isEdit.value
    ? updateRecurring((template.value as { id: string }).id, payload)
    : createRecurring(payload)
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? $t('recurring.modal.editTitle') : $t('recurring.modal.newTitle')"
    :description="$t('recurring.modal.description')"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <UForm :schema="recurringSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UTabs
          :items="typeItems"
          :model-value="state.type"
          size="sm"
          class="w-full"
          @update:model-value="state.type = $event as TransactionType"
        />

        <UFormField :label="$t('recurring.modal.name')" name="description" :help="$t('recurring.modal.nameHelp')" required>
          <UInput v-model="state.description" :placeholder="$t('recurring.modal.namePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('recurring.modal.account')" name="accountId" required>
            <USelectMenu v-model="state.accountId" :items="accountItems" value-key="value" class="w-full" :placeholder="$t('transactions.modal.selectAccount')" />
          </UFormField>
          <UFormField :label="$t('recurring.modal.cadence')" name="cadence" required>
            <USelect v-model="state.cadence" :items="cadenceItems" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('transactions.modal.category')" name="categoryId">
          <USelectMenu v-model="state.categoryId" :items="categoryItems" value-key="value" class="w-full" :placeholder="$t('transactions.modal.noCategory')" />
        </UFormField>

        <UFormField :label="$t('recurring.modal.estimate')" name="amount" :help="$t('recurring.modal.estimateHelp')">
          <UInput
            v-model.number="state.amount"
            type="number"
            step="0.01"
            min="0"
            :placeholder="$t('recurring.modal.estimatePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('recurring.modal.startDate')" name="startDate" :help="$t('recurring.modal.startDateHelp')" required>
            <UInput v-model="state.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="$t('recurring.modal.endDate')" name="endDate" :help="$t('recurring.modal.endDateHelp')">
            <UInput v-model="state.endDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField v-if="isEdit" name="enabled">
          <UCheckbox v-model="state.enabled" :label="$t('recurring.modal.enabled')" :description="$t('recurring.modal.enabledHelp')" />
        </UFormField>

        <ModalActions :is-edit="isEdit" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
