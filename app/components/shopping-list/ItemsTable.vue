<script setup lang="ts">
import { NUMBER_LOCALES } from '~/composables/useLocaleFormat'

// Item shape from /api/v1/shopping-lists/:id (numeric columns arrive as strings).
export interface ShoppingListItemView {
  id: string
  name: string
  quantity: string
  unitPrice: string
  checked: boolean
}

const props = defineProps<{
  listId: string
  items: ShoppingListItemView[]
}>()

const { locale } = useI18n()
const { formatMoney } = useLocaleFormat()
const listsStore = useShoppingListsStore()

// Quantities and prices are only ever stored/shown to 2 decimals.
const round2 = (n: number) => Math.round(n * 100) / 100
const fmtQty = (n: number) =>
  new Intl.NumberFormat(NUMBER_LOCALES[locale.value], { maximumFractionDigits: 2 }).format(n)

// --- Check-off: optimistic (must feel instant while shopping) ---------------
// Local overrides win over server state until the PATCH settles; on failure the
// override is dropped, visually reverting the box (store already toasts).
const checkedOverrides = reactive(new Map<string, boolean>())

async function toggleChecked(id: string, value: boolean) {
  checkedOverrides.set(id, value)
  try {
    await listsStore.updateItem(props.listId, id, { checked: value })
  }
  catch {
    // revert on failure
  }
  finally {
    checkedOverrides.delete(id)
  }
}

// --- Rows: committed items + optimistic pending ones ------------------------
interface Row {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
  checked: boolean
  pending: boolean
}

interface PendingItem { tempId: number, name: string, quantity: number, unitPrice: number }
const pendingItems = ref<PendingItem[]>([])

const rows = computed<Row[]>(() => [
  ...props.items.map((i): Row => {
    const quantity = Number(i.quantity)
    const unitPrice = Number(i.unitPrice)
    return {
      id: i.id,
      name: i.name,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      checked: checkedOverrides.get(i.id) ?? i.checked,
      pending: false,
    }
  }),
  ...pendingItems.value.map((p): Row => ({
    id: `pending-${p.tempId}`,
    name: p.name,
    quantity: p.quantity,
    unitPrice: p.unitPrice,
    total: p.quantity * p.unitPrice,
    checked: false,
    pending: true,
  })),
])

// --- One form for both adding and editing ------------------------------------
// Rows are read-only; the pencil loads a row into this form (edit mode), submit
// PATCHes it. In add mode, submitting is synchronous for the user: a dimmed
// pending row appears, the form resets and the name field refocuses immediately
// — the POST runs in a sequential queue so positions match typing order.
const form = reactive({
  name: '',
  quantity: 1 as number | null,
  unitPrice: null as number | null,
})
const editingId = ref<string | null>(null)
const editingRow = computed(() => rows.value.find(r => r.id === editingId.value))
const saving = ref(false)
const nameRef = useTemplateRef<{ inputRef?: HTMLInputElement }>('nameInput')

let tempId = 0
let queue: Promise<void> = Promise.resolve()

function focusName() {
  nextTick(() => nameRef.value?.inputRef?.focus())
}

function resetForm() {
  form.name = ''
  form.quantity = 1
  form.unitPrice = null
  editingId.value = null
}

function startEdit(row: Row) {
  editingId.value = row.id
  form.name = row.name
  form.quantity = row.quantity
  form.unitPrice = row.unitPrice
  focusName()
}

// Normalized payload from the form (qty falls back to 1, price to 0).
function formValues() {
  const quantity = form.quantity && form.quantity > 0 ? round2(form.quantity) : 1
  const unitPrice = form.unitPrice && form.unitPrice > 0 ? round2(form.unitPrice) : 0
  return { name: form.name.trim(), quantity, unitPrice }
}

async function onSubmit() {
  const values = formValues()
  if (!values.name) return

  if (editingId.value) {
    saving.value = true
    try {
      await listsStore.updateItem(props.listId, editingId.value, values)
      resetForm()
    }
    catch {
      // store toasted; keep the form in edit mode for another attempt
    }
    finally {
      saving.value = false
    }
    return
  }

  const pending: PendingItem = { tempId: ++tempId, ...values }
  pendingItems.value.push(pending)
  resetForm()
  focusName()

  queue = queue.then(async () => {
    try {
      await listsStore.addItem(props.listId, { ...values, checked: false })
    }
    catch {
      // Store toasted the error; put the values back so nothing typed is lost
      // (only if the user hasn't started the next item already).
      if (!form.name.trim() && !editingId.value) {
        form.name = pending.name
        form.quantity = pending.quantity
        form.unitPrice = pending.unitPrice || null
      }
    }
    finally {
      pendingItems.value = pendingItems.value.filter(p => p.tempId !== pending.tempId)
    }
  })
}
</script>

<template>
  <UPageCard variant="subtle" class="overflow-hidden" :ui="{ container: 'p-0 sm:p-0' }">
    <!-- items -->
    <ul v-if="rows.length" class="divide-y divide-default">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex items-center gap-3 px-4 py-2.5"
        :class="[row.pending ? 'opacity-50' : '', editingId === row.id ? 'bg-primary/5' : '']"
      >
        <UCheckbox
          v-if="!row.pending"
          :model-value="row.checked"
          @update:model-value="toggleChecked(row.id, $event === true)"
        />
        <span v-else class="w-4" />

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium" :class="row.checked ? 'line-through text-muted' : ''">
            {{ row.name }}
          </p>
          <p class="text-xs text-muted tabular-nums">
            {{ fmtQty(row.quantity) }} × {{ formatMoney(row.unitPrice, 'VES') }}
          </p>
        </div>

        <span class="shrink-0 text-sm font-medium tabular-nums" :class="row.checked ? 'text-muted' : ''">
          {{ formatMoney(row.total, 'VES') }}
        </span>

        <div v-if="!row.pending" class="flex shrink-0 gap-1">
          <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="startEdit(row)" />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            @click="() => { listsStore.confirmDeleteItem(listId, { id: row.id, name: row.name }) }"
          />
        </div>
      </li>
    </ul>

    <p v-else class="px-4 py-6 text-center text-sm text-muted">
      {{ $t('shoppingLists.noItems') }}
    </p>

    <!-- one form, two modes: add a new item or save the row being edited -->
    <UForm class="space-y-3 border-t border-default p-4" @submit.prevent="onSubmit">
      <p v-if="editingRow" class="flex items-center gap-1.5 text-xs text-muted">
        <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0" />
        <span class="truncate">{{ $t('shoppingLists.entry.editing', { name: editingRow.name }) }}</span>
      </p>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UFormField :label="$t('shoppingLists.table.item')" class="min-w-0 sm:flex-1">
          <UInput
            ref="nameInput"
            v-model="form.name"
            :placeholder="$t('shoppingLists.entry.namePlaceholder')"
            class="w-full"
            :ui="{ base: 'min-w-0' }"
          />
        </UFormField>

        <div class="flex gap-3">
          <UFormField :label="$t('shoppingLists.table.quantity')" class="min-w-0 flex-1 sm:w-24 sm:flex-none">
            <UInput
              v-model.number="form.quantity"
              type="number"
              step="0.01"
              min="0.01"
              :placeholder="$t('shoppingLists.entry.qtyPlaceholder')"
              class="w-full"
              :ui="{ base: 'min-w-0' }"
            />
          </UFormField>

          <UFormField :label="$t('shoppingLists.table.unitPrice')" class="min-w-0 flex-1 sm:w-36 sm:flex-none">
            <UInput
              v-model.number="form.unitPrice"
              type="number"
              step="0.01"
              min="0"
              :placeholder="$t('shoppingLists.entry.pricePlaceholder')"
              class="w-full"
              :ui="{ base: 'min-w-0' }"
            />
          </UFormField>
        </div>

        <div class="flex gap-2">
          <UButton
            type="submit"
            :icon="editingId ? undefined : 'i-lucide-plus'"
            :label="editingId ? $t('common.save') : $t('shoppingLists.entry.add')"
            :loading="saving"
            :disabled="!form.name.trim()"
            class="flex-1 justify-center sm:flex-none"
          />
          <UButton
            v-if="editingId"
            :label="$t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="resetForm(); focusName()"
          />
        </div>
      </div>
    </UForm>
  </UPageCard>
</template>
