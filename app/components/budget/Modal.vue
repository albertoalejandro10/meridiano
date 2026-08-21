<script setup lang="ts">
import { budgetSchema, currencies, type BudgetInput } from '~~/shared/schemas'

const { categoryLabel, sortCategories } = useCategoryLabel()

const budgetsStore = useBudgetsStore()
// `editing` doubles as the mode switch: with an id → edit, without → create
// (possibly prefilled from a "budget this category" shortcut).
const { modalOpen: open, editing: budget } = storeToRefs(budgetsStore)
const { createBudget, updateBudget } = budgetsStore

const isEdit = computed(() => !!budget.value?.id)

const { data: categories } = useCategories()

const state = reactive({
  categoryId: undefined as string | undefined,
  currency: 'USD' as BudgetInput['currency'],
  amount: 0,
})

// Income-only categories can't overspend — budgets track expenses, so offer
// expense-typed and untyped categories only.
const categoryItems = computed(() =>
  sortCategories((categories.value ?? []).filter(c => c.type !== 'INCOME'))
    .map(c => ({ label: categoryLabel(c), value: c.id, icon: c.icon ?? undefined })),
)

const { saving, submit } = useModalForm(open, () => {
  state.categoryId = budget.value?.categoryId
  state.currency = (budget.value?.currency as BudgetInput['currency']) ?? 'USD'
  state.amount = Number(budget.value?.amount ?? 0)
})

const onSubmit = () => submit(() =>
  isEdit.value
    ? updateBudget(budget.value!.id!, { amount: state.amount })
    // POST upserts: picking an already-budgeted category updates its limit.
    : createBudget({ ...state, categoryId: state.categoryId! }),
)
</script>

<template>
  <UModal v-model:open="open" :title="isEdit ? $t('budgets.modal.editTitle') : $t('budgets.modal.newTitle')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="budgetSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('budgets.modal.category')" name="categoryId" required>
          <USelectMenu
            v-model="state.categoryId"
            :items="categoryItems"
            value-key="value"
            :placeholder="$t('budgets.modal.categoryPlaceholder')"
            :disabled="isEdit"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('budgets.modal.amount')" name="amount" :help="$t('budgets.modal.amountHelp')" required>
            <UInput v-model.number="state.amount" type="number" step="0.01" min="0" class="w-full" autofocus />
          </UFormField>
          <UFormField :label="$t('common.currency')" name="currency" :help="isEdit ? $t('budgets.modal.currencyHelp') : undefined">
            <USelect v-model="state.currency" :items="[...currencies]" :disabled="isEdit" class="w-full" />
          </UFormField>
        </div>

        <ModalActions :is-edit="isEdit" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
