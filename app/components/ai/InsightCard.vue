<script setup lang="ts">
// Shared "ask AI, show prose result" card: an empty state with a generate
// button, a loading state, and the result with a regenerate button. The
// caller owns the endpoint call (via `generate`) and all copy (i18n lives in
// the caller, not here, since the label set differs per feature).
const props = defineProps<{
  title: string
  description?: string
  emptyText: string
  generateLabel: string
  regenerateLabel: string
  failedTitle: string
  generate: () => Promise<string>
  // A previously generated result to show on mount (the digest is cached
  // server-side — see server/api/v1/ai/digest.get.ts). `generatedAt` drives the
  // staleness line: a cached result can predate recent transactions, and the
  // user needs to see that before trusting it.
  initialText?: string | null
  generatedAt?: string | null
}>()

const emit = defineEmits<{ generated: [text: string] }>()

const { formatRelativeTime } = useLocaleFormat()
const toast = useToast()

const text = ref<string | null>(props.initialText ?? null)
const at = ref<string | null>(props.generatedAt ?? null)
const pending = ref(false)

// The cached result arrives from a useFetch that may still be in flight on
// mount, and switching locale swaps it for a different one (or none).
watch(() => [props.initialText, props.generatedAt], ([nextText, nextAt]) => {
  if (pending.value) return
  text.value = nextText ?? null
  at.value = nextAt ?? null
})

async function run() {
  pending.value = true
  try {
    text.value = await props.generate()
    at.value = new Date().toISOString()
    emit('generated', text.value)
  }
  catch (err) {
    const e = err as { data?: { statusMessage?: string } }
    toast.add({ title: props.failedTitle, description: e.data?.statusMessage, color: 'error' })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <UPageCard :title="title" :description="description" variant="subtle">
    <!-- Generation takes several seconds, so the wait gets the same skeleton
         treatment as the analytics drilldowns rather than a lone button spinner. -->
    <div v-if="pending" class="space-y-2">
      <USkeleton v-for="i in 4" :key="i" class="h-4" :class="i === 4 ? 'w-2/3' : 'w-full'" />
    </div>

    <div v-else-if="text" class="space-y-4">
      <p class="text-sm whitespace-pre-line">
        {{ text }}
      </p>
      <!-- Scoped rather than rendered here: this card holds no copy of its
           own, so the caller phrases the staleness line in its own keys. -->
      <slot v-if="at" name="meta" :when="formatRelativeTime(at)" />
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :label="regenerateLabel"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="run"
        />
        <slot name="actions" />
      </div>
    </div>

    <div v-else class="flex flex-wrap items-center justify-between gap-4">
      <p class="text-sm text-muted">
        {{ emptyText }}
      </p>
      <UButton
        :label="generateLabel"
        icon="i-lucide-sparkles"
        color="primary"
        variant="subtle"
        class="shrink-0"
        @click="run"
      />
    </div>
  </UPageCard>
</template>
