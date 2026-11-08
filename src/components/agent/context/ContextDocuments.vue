<script setup>
// Documents people add for the agents (positioning notes, product sheets,
// style guides), with how many entries cite each one.
import { Pencil, Trash2 } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import { CONTEXT_LIMITS, plural } from '@/lib/agent/contextSections'

defineProps({
  // [{id, title, chars, cited_by, updated_at, updated_by_name}]
  documents: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'delete'])

function citedLine(doc) {
  const n = Number(doc.cited_by) || 0
  return n ? `Cited by ${plural(n, 'entry', 'entries')}` : 'Not cited yet'
}
</script>

<template>
  <section id="ctx-documents" class="ag-cd" aria-labelledby="ctx-documents-title">
    <div class="ag-cd-head">
      <h2 id="ctx-documents-title" class="ag-cd-title">Documents</h2>
      <p class="ag-cd-help">
        Text you add for the agents: positioning notes, product sheets, style guides. Up to {{ CONTEXT_LIMITS.documents }}.
      </p>
    </div>

    <p v-if="!documents.length" class="ag-cd-none">No documents yet.</p>
    <ul v-else class="ag-cd-list" role="list">
      <li v-for="doc in documents" :key="doc.id" class="ag-cd-row">
        <div class="ag-cd-text">
          <span class="ag-cd-name">{{ doc.title || 'Untitled document' }}</span>
          <span class="ag-cd-meta ag-tnum">{{ plural(doc.chars, 'character', 'characters') }} · {{ citedLine(doc) }}</span>
        </div>
        <div v-if="canEdit" class="ag-cd-actions">
          <AgButton
            size="xs"
            variant="ghost"
            :icon="Pencil"
            :aria-label="`Edit ${doc.title || 'document'}`"
            @click="emit('edit', doc)"
          >
            Edit
          </AgButton>
          <AgButton
            size="xs"
            variant="ghost"
            :icon="Trash2"
            :aria-label="`Delete ${doc.title || 'document'}`"
            @click="emit('delete', doc)"
          >
            Delete
          </AgButton>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.ag-cd {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 16px;
}

.ag-cd-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ag-cd-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.ag-cd-help,
.ag-cd-none {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-cd-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  list-style: none;
}

.ag-cd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 12px 10px 16px;
  border-top: 1px solid var(--ag-card-border);
}

.ag-cd-row:first-child {
  border-top: 0;
}

.ag-cd-text {
  display: flex;
  flex: 1 1 220px;
  flex-direction: column;
  min-width: 0;
}

.ag-cd-name {
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-cd-meta {
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-cd-actions {
  display: flex;
  gap: 4px;
}
</style>
