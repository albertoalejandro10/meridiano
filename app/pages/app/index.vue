<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Dashboard' })

const { accounts } = useAccounts()
const { data: txData } = useTransactions()

const totalsByCurrency = computed(() => {
  const totals: Record<string, number> = {}
  for (const a of accounts.value) {
    if (a.archived) continue
    totals[a.currency] = (totals[a.currency] ?? 0) + a.balance
  }
  return Object.entries(totals)
})

const recentTransactions = computed(() => txData.value.items.slice(0, 8))

const newTxOpen = ref(false)
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #right>
          <UButton label="New transaction" icon="i-lucide-plus" @click="newTxOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UPageGrid class="lg:grid-cols-3">
          <UPageCard
            v-for="[currency, total] in totalsByCurrency"
            :key="currency"
            :title="`Total ${currency}`"
            variant="subtle"
          >
            <span class="text-2xl font-semibold" :class="total < 0 ? 'text-error' : ''">
              {{ formatMoney(total, currency) }}
            </span>
          </UPageCard>
          <UPageCard v-if="!totalsByCurrency.length" title="No accounts yet" variant="subtle">
            <UButton label="Create your first account" to="/app/accounts" variant="link" :padded="false" />
          </UPageCard>
        </UPageGrid>

        <UPageCard title="Recent transactions" variant="subtle">
          <div v-if="recentTransactions.length" class="divide-y divide-default">
            <div
              v-for="tx in recentTransactions"
              :key="tx.id"
              class="flex items-center justify-between py-2.5 gap-4"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ tx.description || tx.category?.name || (tx.type === 'INCOME' ? 'Income' : 'Expense') }}
                </p>
                <p class="text-xs text-muted">
                  {{ tx.account?.name }} · {{ new Date(tx.date).toLocaleDateString() }}
                </p>
              </div>
              <span
                class="text-sm font-semibold shrink-0"
                :class="tx.type === 'INCOME' ? 'text-success' : 'text-error'"
              >
                {{ tx.type === 'INCOME' ? '+' : '−' }}{{ formatMoney(Number(tx.amount), tx.currency) }}
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            No transactions yet.
          </p>
        </UPageCard>
      </div>

      <TransactionModal v-model:open="newTxOpen" />
    </template>
  </UDashboardPanel>
</template>
