<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Accounts' })

const { accounts, deleteAccount } = useAccounts()

const modalOpen = ref(false)
const editing = ref<typeof accounts.value[number] | undefined>()

function openCreate() {
  editing.value = undefined
  modalOpen.value = true
}

function openEdit(account: typeof accounts.value[number]) {
  editing.value = account
  modalOpen.value = true
}

const typeIcons: Record<string, string> = {
  CASH: 'i-lucide-banknote',
  BANK: 'i-lucide-landmark',
  CARD: 'i-lucide-credit-card',
  SAVINGS: 'i-lucide-piggy-bank',
  OTHER: 'i-lucide-wallet',
}
</script>

<template>
  <UDashboardPanel id="accounts">
    <template #header>
      <UDashboardNavbar title="Accounts">
        <template #right>
          <UButton label="New account" icon="i-lucide-plus" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageGrid v-if="accounts.length" class="lg:grid-cols-3">
        <UPageCard
          v-for="account in accounts"
          :key="account.id"
          :title="account.name"
          :icon="typeIcons[account.type]"
          variant="subtle"
          :class="account.archived ? 'opacity-60' : ''"
        >
          <template #description>
            <UBadge :label="account.type" color="neutral" variant="subtle" size="sm" />
            <UBadge v-if="account.archived" label="Archived" color="warning" variant="subtle" size="sm" class="ml-1" />
          </template>

          <div class="flex items-end justify-between">
            <span class="text-xl font-semibold" :class="account.balance < 0 ? 'text-error' : ''">
              {{ formatMoney(account.balance, account.currency) }}
            </span>
            <div class="flex gap-1">
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" @click="openEdit(account)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="deleteAccount(account.id)" />
            </div>
          </div>
        </UPageCard>
      </UPageGrid>

      <div v-else class="flex flex-col items-center gap-4 py-24 text-center">
        <UIcon name="i-lucide-wallet" class="size-10 text-muted" />
        <p class="text-muted">
          No accounts yet. Create one to start tracking.
        </p>
        <UButton label="New account" icon="i-lucide-plus" @click="openCreate" />
      </div>

      <AccountModal v-model:open="modalOpen" :account="editing" />
    </template>
  </UDashboardPanel>
</template>
