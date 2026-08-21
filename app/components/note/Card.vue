<script setup lang="ts">
const props = defineProps<{ note: NoteRow }>()
defineEmits<{ edit: [], delete: [], pin: [], tag: [tag: string] }>()

const { formatRelativeTime } = useLocaleFormat()

const preview = computed(() => notePreview(props.note.content))
</script>

<template>
  <div class="relative flex flex-col gap-3 rounded-lg p-5 ring ring-default bg-elevated/40 transition-colors hover:bg-elevated">
    <!-- Whole-card link, with the interactive bits lifted above it via z-10. -->
    <NuxtLink :to="`/app/notes/${note.id}`" class="absolute inset-0 rounded-lg" :aria-label="$t('notes.card.open', { title: note.title })" />

    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2">
        <UIcon v-if="note.pinned" name="i-lucide-pin" class="mt-0.5 size-4 shrink-0 text-primary" />
        <p class="line-clamp-2 font-medium">
          {{ note.title }}
        </p>
      </div>
      <div class="relative z-10 flex shrink-0 gap-1">
        <UButton
          :icon="note.pinned ? 'i-lucide-pin-off' : 'i-lucide-pin'"
          :color="note.pinned ? 'primary' : 'neutral'"
          variant="ghost"
          size="xs"
          :aria-label="note.pinned ? $t('notes.unpin') : $t('notes.pin')"
          @click="$emit('pin')"
        />
        <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.edit')" @click="$emit('edit')" />
        <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :aria-label="$t('common.delete')" @click="$emit('delete')" />
      </div>
    </div>

    <p v-if="preview" class="line-clamp-3 text-sm text-muted">
      {{ preview }}
    </p>
    <p v-else class="text-sm italic text-dimmed">
      {{ $t('notes.card.empty') }}
    </p>

    <div class="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
      <UBadge
        v-for="tag in note.tags"
        :key="tag"
        :label="tag"
        color="neutral"
        variant="subtle"
        size="sm"
        class="relative z-10 cursor-pointer"
        @click="$emit('tag', tag)"
      />
      <span class="ml-auto text-xs text-dimmed">{{ formatRelativeTime(note.updatedAt) }}</span>
    </div>
  </div>
</template>
