<script setup lang="ts">
import type { TransactionFilters } from '~/composables/useTransactions'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Transactions' })

const filters = ref<TransactionFilters>({})
const { data, deleteTransaction } = useTransactions(filters)
const { accounts } = useAccounts()

const modalOpen = ref(false)
const editing = ref<typeof data.value.items[number] | undefined>()

function openCreate() {
  editing.value = undefined
  modalOpen.value = true
}

function openEdit(tx: typeof data.value.items[number]) {
  editing.value = tx
  modalOpen.value = true
}

const accountFilterItems = computed(() => [
  { label: 'All accounts', value: undefined },
  ...accounts.value.map(a => ({ label: a.name, value: a.id })),
])

const typeFilterItems = [
  { label: 'All types', value: undefined },
  { label: 'Income', value: 'INCOME' },
  { label: 'Expense', value: 'EXPENSE' },
]
</script>

<template>
  <UDashboardPanel id="transactions">
    <template #header>
      <UDashboardNavbar title="Transactions">
        <template #right>
          <UButton label="New transaction" icon="i-lucide-plus" @click="openCreate" />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <USelect
            v-model="filters.accountId"
            :items="accountFilterItems"
            value-key="value"
            placeholder="All accounts"
            class="w-44"
          />
          <USelect
            v-model="filters.type"
            :items="typeFilterItems"
            value-key="value"
            placeholder="All types"
            class="w-36"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div v-if="data.items.length" class="divide-y divide-default">
        <div
          v-for="tx in data.items"
          :key="tx.id"
          class="flex items-center justify-between gap-4 py-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <UIcon
              :name="tx.category?.icon || (tx.type === 'INCOME' ? 'i-lucide-arrow-down-left' : 'i-lucide-arrow-up-right')"
              class="size-5 shrink-0"
              :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">
                {{ tx.description || tx.category?.name || (tx.type === 'INCOME' ? 'Income' : 'Expense') }}
              </p>
              <p class="text-xs text-muted">
                {{ tx.account?.name }} · {{ new Date(tx.date).toLocaleDateString() }}
                <span v-if="tx.category && tx.description"> · {{ tx.category.name }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-sm font-semibold"
              :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'"
            >
              {{ tx.type === 'INCOME' ? '+' : '−' }}{{ formatMoney(Number(tx.amount), tx.currency) }}
            </span>
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(tx)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="deleteTransaction(tx.id)" />
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-arrow-left-right" class="size-10 text-muted" />
        <p class="text-muted">
          No transactions found.
        </p>
        <UButton label="New transaction" icon="i-lucide-plus" @click="openCreate" />
      </div>

      <TransactionModal v-model:open="modalOpen" :transaction="editing" />
    </template>
  </UDashboardPanel>
</template>
