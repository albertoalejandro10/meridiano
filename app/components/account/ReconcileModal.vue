<script setup lang="ts">
import { reconcileSchema } from '~~/shared/schemas'

const { t } = useI18n()
const { formatMoney, formatFullDate } = useLocaleFormat()

const accountsStore = useAccountsStore()
const { reconcileModalOpen: open, reconcilingAccount: account } = storeToRefs(accountsStore)
const { reconcileAccount } = accountsStore

const state = reactive<{ statedBalance: number | null, date: string }>({
  statedBalance: null,
  date: toISODate(new Date()),
})

// On by default: a user who typed a different balance almost always means "make
// it this". Unchecking keeps the checkpoint informational, for a gap they still
// intend to hunt down transaction by transaction.
const adjust = ref(true)

const { saving, submit } = useModalForm(open, () => {
  // Deliberately not prefilled with the recorded balance — the whole point is
  // that the user types what their bank actually shows.
  state.statedBalance = null
  state.date = toISODate(new Date())
  adjust.value = true
})

const liability = computed(() => account.value ? accountGroup(account.value.type) === 'liability' : false)

// Real (stated) minus recorded. Null until an amount is typed.
const diff = computed(() => {
  if (state.statedBalance === null || typeof state.statedBalance !== 'number' || !account.value) return null
  const d = state.statedBalance - account.value.balance
  return Math.abs(d) < 0.005 ? 0 : d
})

// Which kind of transactions the difference points at: on assets more real
// money means unregistered income; on liabilities more owed means
// unregistered charges (and vice versa).
const diffMessage = computed(() => {
  if (diff.value === null || diff.value === 0 || !account.value) return null
  const amount = formatMoney(Math.abs(diff.value), account.value.currency)
  if (liability.value) {
    return diff.value > 0 ? t('accounts.reconcile.missingCharges', { amount }) : t('accounts.reconcile.missingPayments', { amount })
  }
  return diff.value > 0 ? t('accounts.reconcile.missingIncome', { amount }) : t('accounts.reconcile.missingExpenses', { amount })
})

// Whether saving will actually write a correction — drives the preview, the
// submit label and (in the store) which toast fires, so all three agree.
const adjusting = computed(() => adjust.value && diff.value !== null && diff.value !== 0)

// What the correction will add, spelled out before it happens. Two keys rather
// than an interpolated noun: Spanish needs "un ingreso" / "un gasto".
const adjustPreview = computed(() => {
  if (!adjusting.value || !account.value) return undefined
  // On an asset a shortfall is a missing expense; on a liability owing more is a
  // missing charge — same flip the server applies.
  const isExpense = liability.value ? diff.value! > 0 : diff.value! < 0
  return t(`accounts.reconcile.${isExpense ? 'adjustPreviewExpense' : 'adjustPreviewIncome'}`, {
    amount: formatMoney(Math.abs(diff.value!), account.value.currency),
    date: formatFullDate(state.date),
  })
})

async function onSubmit() {
  const reconciling = account.value
  if (!reconciling || state.statedBalance === null) return

  await submit(() => reconcileAccount(reconciling.id, {
    statedBalance: Number(state.statedBalance),
    date: new Date(state.date),
    applyAdjustment: adjusting.value,
  }))
}
</script>

<template>
  <UModal v-model:open="open" :title="account ? $t('accounts.reconcile.titleNamed', { name: account.name }) : $t('accounts.reconcile.title')">
    <template #body>
      <UForm :schema="reconcileSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <p class="text-sm text-muted">
          {{ $t('accounts.reconcile.intro') }}
        </p>

        <div v-if="account" class="rounded-lg bg-elevated/50 px-3 py-2 text-sm space-y-0.5">
          <p class="flex items-center justify-between gap-4">
            <span class="text-muted">{{ liability ? $t('accounts.reconcile.recordedOwed') : $t('accounts.reconcile.recordedBalance') }}</span>
            <span class="font-semibold tabular-nums">{{ formatMoney(account.balance, account.currency) }}</span>
          </p>
          <p v-if="account.lastReconciliation" class="flex items-center justify-between gap-4 text-xs text-muted">
            <span>{{ $t('accounts.reconcile.lastReconciled') }}</span>
            <span>{{ formatFullDate(account.lastReconciliation.date) }} · {{ formatMoney(account.lastReconciliation.statedBalance, account.currency) }}</span>
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField :label="liability ? $t('accounts.reconcile.actualOwed') : $t('accounts.reconcile.actualBalance')" name="statedBalance" required>
            <UInput v-model.number="state.statedBalance" type="number" step="0.01" placeholder="0.00" class="w-full" autofocus />
          </UFormField>
          <UFormField :label="$t('common.date')" name="date">
            <UInput v-model="state.date" type="date" class="w-full" />
          </UFormField>
        </div>

        <UAlert
          v-if="diff === 0"
          color="success"
          variant="subtle"
          icon="i-lucide-check-circle-2"
          :title="$t('accounts.reconcile.match')"
        />
        <template v-else-if="diffMessage">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="diffMessage"
            :description="adjustPreview ?? $t('accounts.reconcile.diffHint')"
          />
          <UCheckbox v-model="adjust" :label="$t('accounts.reconcile.adjust')" />
        </template>

        <ModalActions
          :submit-label="adjusting ? $t('accounts.reconcile.submitAdjust') : $t('accounts.reconcile.submit')"
          :saving="saving"
          :disabled="state.statedBalance === null"
          @cancel="open = false"
        />
      </UForm>
    </template>
  </UModal>
</template>
