<script setup lang="ts">
import NoteCodeBlock from './CodeBlock.vue'

defineProps<{ content: string }>()

// Only `pre` is overridden. Registering it here rather than in the global
// `app/components/prose/` directory keeps the copy button scoped to notes and
// leaves the AI chat's markdown rendering exactly as it was.
const components = { pre: NoteCodeBlock }
</script>

<template>
  <div class="note-content text-sm leading-relaxed text-default">
    <Comark :components="components">{{ content }}</Comark>
  </div>
</template>

<style scoped>
/* Comark emits bare HTML tags (the Nuxt module runs with prose components off)
   and Tailwind's preflight strips their browser defaults, so the container
   supplies its own typography. Semantic Nuxt UI colors keep it theme-aware in
   both light and dark. `:deep` is required: these nodes are rendered by Comark,
   so they never carry this component's scope attribute. */
.note-content :deep(> *:first-child) {
  margin-top: 0;
}

.note-content :deep(> *:last-child) {
  margin-bottom: 0;
}

.note-content :deep(h1),
.note-content :deep(h2),
.note-content :deep(h3),
.note-content :deep(h4) {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.5em 0 0.5em;
  color: var(--ui-text-highlighted);
}

.note-content :deep(h1) { font-size: 1.5em; }
.note-content :deep(h2) { font-size: 1.25em; }
.note-content :deep(h3) { font-size: 1.1em; }

.note-content :deep(p) {
  margin: 0.75em 0;
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin: 0.75em 0;
  padding-left: 1.5em;
}

.note-content :deep(ul) { list-style: disc; }
.note-content :deep(ol) { list-style: decimal; }

.note-content :deep(li) {
  margin: 0.25em 0;
}

/* Checklists (`- [ ] item`) render a checkbox, which the bullet duplicates. */
.note-content :deep(li:has(> input[type="checkbox"])) {
  list-style: none;
  margin-left: -1.25em;
}

.note-content :deep(input[type="checkbox"]) {
  margin-right: 0.5em;
  accent-color: var(--ui-primary);
}

.note-content :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.note-content :deep(strong) { font-weight: 600; }
.note-content :deep(em) { font-style: italic; }
.note-content :deep(del) { text-decoration: line-through; }

.note-content :deep(blockquote) {
  margin: 0.75em 0;
  padding-left: 1em;
  border-left: 2px solid var(--ui-border-accented);
  color: var(--ui-text-muted);
}

/* Inline code only — a fenced block goes through NoteCodeBlock, which styles
   its own `pre` and must not inherit the inline pill treatment. */
.note-content :deep(code) {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
}

.note-content :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: inherit;
}

.note-content :deep(hr) {
  margin: 1.5em 0;
  border-top: 1px solid var(--ui-border);
}

.note-content :deep(table) {
  display: block;
  overflow-x: auto;
  margin: 1em 0;
  border-collapse: collapse;
}

.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 0.4em 0.7em;
  text-align: left;
}

.note-content :deep(th) {
  background: var(--ui-bg-elevated);
  font-weight: 600;
}

.note-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--ui-radius);
}
</style>
