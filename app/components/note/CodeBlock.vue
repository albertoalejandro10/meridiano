<script setup lang="ts">
// Comark renders a fenced block as ['pre', { language }, ['code', …]]. NoteContent
// maps `pre` here so a saved command arrives with the one affordance that makes
// it worth saving — a copy button — plus the language it was written in.
const props = defineProps<{ language?: string, __node?: unknown }>()

const { t } = useI18n()
const { copied, copy } = useCopy()

// The clipboard gets the fence's raw source from the AST, not the rendered DOM
// text — no risk of picking up decoration that isn't part of the command.
const source = computed(() => comarkText(props.__node))
</script>

<template>
  <div class="my-4 overflow-hidden rounded-lg ring ring-default bg-elevated/40">
    <div class="flex items-center justify-between gap-2 border-b border-default px-3 py-1.5">
      <span class="font-mono text-xs text-muted">{{ language || t('notes.code.plainText') }}</span>
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :color="copied ? 'success' : 'neutral'"
        variant="ghost"
        size="xs"
        :aria-label="copied ? t('notes.code.copied') : t('notes.code.copy')"
        @click="copy(source)"
      />
    </div>
    <pre class="overflow-x-auto p-3 text-sm"><slot /></pre>
  </div>
</template>
