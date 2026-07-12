<script setup lang="ts">
import type { ListboxItem } from '@nuxt/ui'
import { goalSchema, goalIcons, goalColors, currencies, type GoalInput } from '~~/shared/schemas'

const { t } = useI18n()
const { formatMoney } = useLocaleFormat()

const goalsStore = useGoalsStore()
// `editing` doubles as the mode switch: set → edit that goal, unset → create.
const { modalOpen: open, editing: goal } = storeToRefs(goalsStore)
const { createGoal, updateGoal } = goalsStore

const { accounts } = storeToRefs(useAccountsStore())

const state = reactive({
  name: '',
  targetAmount: 0,
  currency: 'USD' as GoalInput['currency'],
  startDate: toISODate(new Date()),
  targetDate: undefined as string | undefined,
  icon: 'i-lucide-target' as GoalInput['icon'],
  color: 'sky' as GoalInput['color'],
  accountIds: [] as string[],
})

const accent = computed(() => goalAccent(state.color))

// Icon options carry the "what am I saving for" usage (label + description) so the
// picker reads like a purpose, not a sticker sheet. See goalIconKeys in utils/goals.ts.
const iconItems = computed(() =>
  goalIcons.map((icon) => {
    const { labelKey, descriptionKey } = goalIconKeys(icon)
    return { value: icon, icon, label: t(labelKey), description: t(descriptionKey) }
  }),
)

// Asset accounts eligible to back this goal: active, asset-type, same currency (no FX).
const assetOptions = computed(() =>
  (accounts.value ?? []).filter(a =>
    !a.archived && accountGroup(a.type) === 'asset' && a.currency === state.currency,
  ),
)

// Shaped for <UListbox>: `value` is the id v-model binds to; balance/currency ride
// along for the trailing slot.
const assetItems = computed<ListboxItem[]>(() =>
  assetOptions.value.map(a => ({
    label: a.name,
    icon: accountTypeIcon(a.type),
    value: a.id,
    balance: a.balance,
    currency: a.currency,
  })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = goal.value?.name ?? ''
  state.targetAmount = Number(goal.value?.targetAmount ?? 0)
  state.currency = (goal.value?.currency as GoalInput['currency']) ?? 'USD'
  state.startDate = toISODate(goal.value?.startDate ?? new Date())
  state.targetDate = goal.value?.targetDate ? toISODate(goal.value.targetDate) : undefined
  state.icon = (goal.value?.icon as GoalInput['icon']) ?? 'i-lucide-target'
  state.color = (goal.value?.color as GoalInput['color']) ?? 'sky'
  state.accountIds = goal.value?.linkedAccounts?.map(a => a.id) ?? []
})

// Dropping the currency invalidates cross-currency selections.
watch(() => state.currency, (cur) => {
  const allowed = new Set(
    (accounts.value ?? []).filter(a => a.currency === cur && accountGroup(a.type) === 'asset').map(a => a.id),
  )
  state.accountIds = state.accountIds.filter(id => allowed.has(id))
})

const saving = ref(false)

async function onSubmit() {
  saving.value = true
  try {
    const input = {
      ...state,
      accountIds: [...state.accountIds],
      startDate: new Date(state.startDate),
      targetDate: state.targetDate ? new Date(state.targetDate) : null,
    }
    if (goal.value) await updateGoal(goal.value.id, input)
    else await createGoal(input)
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
  <UModal v-model:open="open" :title="goal ? $t('goals.modal.editTitle') : $t('goals.modal.newTitle')" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <UForm :schema="goalSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="$t('common.name')" name="name" required>
          <UInput v-model="state.name" :placeholder="$t('goals.modal.namePlaceholder')" class="w-full" autofocus />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('goals.modal.targetAmount')" name="targetAmount" required>
            <UInput v-model.number="state.targetAmount" type="number" step="0.01" min="0" class="w-full" />
          </UFormField>
          <UFormField :label="$t('common.currency')" name="currency" :help="goal ? $t('goals.modal.currencyHelp') : undefined">
            <USelect v-model="state.currency" :items="[...currencies]" :disabled="!!goal" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="$t('goals.modal.startDate')" name="startDate" :help="$t('goals.modal.startDateHelp')">
            <UInput v-model="state.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="$t('goals.modal.targetDate')" name="targetDate" :help="$t('goals.modal.targetDateHelp')">
            <UInput v-model="state.targetDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <UFormField :label="$t('goals.modal.icon')" name="icon" :help="$t('goals.modal.iconHelp')">
          <URadioGroup
            v-model="state.icon"
            :items="iconItems"
            variant="card"
            size="sm"
            :ui="{ fieldset: 'grid grid-cols-2 gap-2 w-full', item: 'w-full' }"
          >
            <template #label="{ item }">
              <span class="flex items-center gap-2 font-medium">
                <UIcon :name="item.icon" class="size-4 shrink-0" :class="accent.text" />
                {{ item.label }}
              </span>
            </template>
          </URadioGroup>
        </UFormField>

        <UFormField :label="$t('goals.modal.color')" name="color">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in goalColors"
              :key="c"
              type="button"
              class="flex size-7 items-center justify-center rounded-full transition hover:scale-110"
              :class="goalColorClasses[c].solid"
              :aria-label="c"
              @click="state.color = c"
            >
              <UIcon v-if="state.color === c" name="i-lucide-check" class="size-4 text-white" />
            </button>
          </div>
        </UFormField>

        <UFormField :label="$t('goals.modal.linkedAssets')" name="accountIds" :help="$t('goals.modal.linkedAssetsHelp')">
          <UListbox
            v-if="assetItems.length"
            v-model="state.accountIds"
            multiple
            value-key="value"
            :items="assetItems"
            :ui="{ content: 'max-h-44', itemTrailingIcon: accent.text }"
          >
            <template #item-trailing="{ item }">
              <span class="text-xs text-muted">{{ formatMoney(item.balance, item.currency) }}</span>
            </template>
          </UListbox>
          <p v-else class="text-xs text-muted">
            {{ $t('goals.modal.noAssets', { currency: state.currency }) }}
          </p>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton type="submit" :label="goal ? $t('common.save') : $t('common.create')" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
