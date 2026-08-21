<script setup lang="ts">
import type { RecurringConfirmItem } from '~~/shared/schemas'
import type { RecurringOccurrence } from '~/stores/recurring'

// "Did you pay these?" — one row per due date the app hasn't been told about.
// Nothing here has been written yet: answering is what creates transactions.
const recurringStore = useRecurringStore()
const { reviewOpen: open, pending } = storeToRefs(recurringStore)

const { formatFullDate, formatMoney } = useLocaleFormat()
const { categoryLabel } = useCategoryLabel()

// Per-row answer, keyed by template + due date (the pair the API is keyed on).
interface Answer {
  status: 'PAID' | 'SKIPPED' | null
  amount: number | undefined
  date: string
  note: string
}

const answers = ref<Record<string, Answer>>({})

function keyOf(item: RecurringOccurrence) {
  return `${item.recurringId}:${item.dueDate}`
}

// Rebuilt on every open so a refreshed pending list can't leave stale rows.
// Nothing is pre-answered: an unanswered row is simply left alone, which is the
// honest default when the user doesn't remember.
watch(open, (isOpen) => {
  if (!isOpen) return
  const next: Record<string, Answer> = {}
  for (const item of pending.value) {
    next[keyOf(item)] = {
      status: null,
      // Prices drift, so the last real figure beats the template's estimate.
      amount: item.lastPaidAmount ?? item.estimate ?? undefined,
      date: item.dueDate,
      note: '',
    }
  }
  answers.value = next
})

function setStatus(item: RecurringOccurrence, status: 'PAID' | 'SKIPPED') {
  const answer = answers.value[keyOf(item)]
  if (!answer) return
  // Clicking the active choice again clears it — the way to un-answer a row.
  answer.status = answer.status === status ? null : status
}

function markAll(status: 'PAID' | 'SKIPPED') {
  for (const item of pending.value) {
    const answer = answers.value[keyOf(item)]
    if (!answer) continue
    // "Mark all paid" can only speak for rows that have an amount to use.
    if (status === 'PAID' && !answer.amount) continue
    answer.status = status
  }
}

const answered = computed(() =>
  pending.value.filter((item) => {
    const answer = answers.value[keyOf(item)]
    return answer?.status === 'SKIPPED' || (answer?.status === 'PAID' && !!answer.amount)
  }),
)

// A row marked paid without an amount can't be submitted — flag it inline
// rather than letting the server 422 the whole batch.
const missingAmount = computed(() =>
  pending.value.filter(item => answers.value[keyOf(item)]?.status === 'PAID' && !answers.value[keyOf(item)]?.amount),
)

const saving = ref(false)

async function onSubmit() {
  const items: RecurringConfirmItem[] = answered.value.map((item) => {
    const answer = answers.value[keyOf(item)]!
    return {
      recurringId: item.recurringId,
      dueDate: new Date(item.dueDate),
      status: answer.status!,
      amount: answer.status === 'PAID' ? answer.amount : null,
      date: answer.status === 'PAID' ? new Date(answer.date) : null,
      categoryId: null,
      note: answer.note.trim() || null,
    }
  })
  if (!items.length) return

  saving.value = true
  try {
    await recurringStore.confirmOccurrences(items)
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
  <UModal
    v-model:open="open"
    :title="$t('recurring.review.title')"
    :description="$t('recurring.review.description')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-3">
        <div
          v-for="item in pending"
          :key="keyOf(item)"
          class="rounded-lg border border-default p-3"
          :class="answers[keyOf(item)]?.status ? 'bg-elevated/40' : ''"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">
                {{ item.description }}
              </p>
              <p class="text-xs text-muted">
                {{ formatFullDate(item.dueDate) }} · {{ item.accountName }}
                <template v-if="item.categoryName"> · {{ categoryLabel({ slug: item.categorySlug, name: item.categoryName }) }}</template>
              </p>
            </div>

            <div class="flex gap-1">
              <UButton
                :label="$t('recurring.review.paid')"
                icon="i-lucide-check"
                size="xs"
                :color="answers[keyOf(item)]?.status === 'PAID' ? 'success' : 'neutral'"
                :variant="answers[keyOf(item)]?.status === 'PAID' ? 'solid' : 'subtle'"
                @click="setStatus(item, 'PAID')"
              />
              <UButton
                :label="$t('recurring.review.skipped')"
                icon="i-lucide-minus"
                size="xs"
                :color="answers[keyOf(item)]?.status === 'SKIPPED' ? 'warning' : 'neutral'"
                :variant="answers[keyOf(item)]?.status === 'SKIPPED' ? 'solid' : 'subtle'"
                @click="setStatus(item, 'SKIPPED')"
              />
            </div>
          </div>

          <!-- Paid: the real amount and the day it actually left the account -->
          <div v-if="answers[keyOf(item)]?.status === 'PAID'" class="mt-3 grid grid-cols-2 gap-3">
            <UFormField :label="$t('common.amount')" :error="!answers[keyOf(item)]?.amount ? $t('recurring.review.amountRequired') : undefined">
              <UInput
                v-model.number="answers[keyOf(item)]!.amount"
                type="number"
                step="0.01"
                min="0"
                class="w-full"
                :trailing="false"
              >
                <template #trailing>
                  <span class="text-xs text-dimmed">{{ item.currency }}</span>
                </template>
              </UInput>
            </UFormField>
            <UFormField :label="$t('recurring.review.paidOn')">
              <UInput v-model="answers[keyOf(item)]!.date" type="date" class="w-full" />
            </UFormField>
            <p v-if="item.lastPaidAmount != null" class="col-span-2 -mt-1 text-xs text-muted">
              {{ $t('recurring.review.lastPaid', { amount: formatMoney(item.lastPaidAmount, item.currency) }) }}
            </p>
          </div>

          <!-- Skipped: why, so the gap makes sense months later -->
          <div v-else-if="answers[keyOf(item)]?.status === 'SKIPPED'" class="mt-3">
            <UFormField :label="$t('recurring.review.note')" :help="$t('recurring.review.noteHelp')">
              <UInput
                v-model="answers[keyOf(item)]!.note"
                :placeholder="$t('recurring.review.notePlaceholder')"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <UButton :label="$t('recurring.review.markAllPaid')" color="neutral" variant="ghost" size="sm" @click="markAll('PAID')" />
          <UButton :label="$t('recurring.review.skipAll')" color="neutral" variant="ghost" size="sm" @click="markAll('SKIPPED')" />
        </div>
        <div class="flex items-center gap-2">
          <UButton :label="$t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
          <UButton
            :label="$t('recurring.review.action', { count: answered.length }, answered.length)"
            :disabled="answered.length === 0 || missingAmount.length > 0"
            :loading="saving"
            @click="onSubmit()"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
