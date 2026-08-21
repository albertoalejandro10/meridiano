<script setup lang="ts">
import { transactionRuleSchema } from '~~/shared/schemas'

const { groupCategoryItems } = useCategoryLabel()

const rulesStore = useRulesStore()
// `editing` doubles as the mode switch: with an id → edit, without → create.
const { modalOpen: open, editing: rule } = storeToRefs(rulesStore)
const { createRule, updateRule } = rulesStore

const isEdit = computed(() => !!rule.value?.id)

const { data: categories } = useCategories()

const state = reactive({
  keyword: '',
  categoryId: undefined as string | undefined,
  enabled: true,
})

// All categories are offered; a type-restricted category simply only fires on
// transactions of that type (the help text explains this). Both types show, so
// the list is grouped under Income/Expense headers.
const categoryItems = computed(() => groupCategoryItems(categories.value ?? []))

const { saving, submit } = useModalForm(open, () => {
  state.keyword = rule.value?.keyword ?? ''
  state.categoryId = rule.value?.categoryId
  state.enabled = rule.value?.enabled ?? true
})

const onSubmit = () => submit(() => {
  const input = { keyword: state.keyword, categoryId: state.categoryId!, enabled: state.enabled }
  return isEdit.value ? updateRule(rule.value!.id, input) : createRule(input)
})
</script>

<template>
  <UModal v-model:open="open" :title="isEdit ? $t('rules.modal.editTitle') : $t('rules.modal.newTitle')" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="transactionRuleSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('rules.modal.keyword')" name="keyword" :help="$t('rules.modal.keywordHelp')" required>
          <UInput v-model="state.keyword" :placeholder="$t('rules.modal.keywordPlaceholder')" class="w-full" autofocus />
        </UFormField>

        <UFormField :label="$t('rules.modal.category')" name="categoryId" :help="$t('rules.modal.categoryHelp')" required>
          <USelectMenu
            v-model="state.categoryId"
            :items="categoryItems"
            value-key="value"
            :placeholder="$t('rules.modal.categoryPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField name="enabled">
          <USwitch v-model="state.enabled" :label="$t('rules.modal.enabled')" />
        </UFormField>

        <ModalActions :is-edit="isEdit" :saving="saving" @cancel="open = false" />
      </UForm>
    </template>
  </UModal>
</template>
