<script setup>
// One context section: its help, the suggestions waiting first, then the
// active entries in order, and Add entry. An entry being edited (or a new
// one) shows its form in place; the page owns the forms' requests.
import { computed } from 'vue'
import { Plus } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { CONTEXT_LIMITS } from '@/lib/agent/contextSections'
import ContextEntryCard from './ContextEntryCard.vue'

const props = defineProps({
  // {key, label, help}
  section: { type: Object, required: true },
  // this section's entries, any status
  entries: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  // id of the entry whose form is open, 'new' for a new entry here, '' for none
  editing: { type: String, default: '' },
  // entry ids with an accept or dismiss in flight
  busyIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['add', 'accept', 'dismiss', 'edit', 'add-source', 'delete'])

const ordered = computed(() => {
  const byPosition = (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0)
  const suggested = props.entries.filter((e) => e.status === 'suggested').sort(byPosition)
  const active = props.entries.filter((e) => e.status !== 'suggested').sort(byPosition)
  return [...suggested, ...active]
})

// 40 per section, active and suggested together.
const full = computed(() => props.entries.length >= CONTEXT_LIMITS.entries)
const fullText = `This section has ${CONTEXT_LIMITS.entries} entries, the limit.`
const titleId = computed(() => `ctx-${props.section.key}-title`)
</script>

<template>
  <section :id="`ctx-${section.key}`" class="ag-cs" :aria-labelledby="titleId">
    <div class="ag-cs-head">
      <h2 :id="titleId" class="ag-cs-title">{{ section.label }}</h2>
      <p class="ag-cs-help">{{ section.help }}</p>
    </div>

    <ul v-if="ordered.length || editing" class="ag-cs-list" role="list">
      <li v-for="entry in ordered" :key="entry.id">
        <slot v-if="editing === entry.id" name="form" :entry="entry" />
        <ContextEntryCard
          v-else
          :entry="entry"
          :can-edit="canEdit"
          :busy="busyIds.includes(entry.id)"
          @accept="emit('accept', entry)"
          @dismiss="emit('dismiss', entry)"
          @edit="emit('edit', entry)"
          @add-source="emit('add-source', entry)"
          @delete="emit('delete', entry)"
        />
      </li>
      <li v-if="editing === 'new'">
        <slot name="form" :entry="null" />
      </li>
    </ul>

    <template v-if="canEdit && editing !== 'new'">
      <!-- At the limit the button stays focusable, so its tooltip says why. -->
      <AgTooltip v-if="full" :text="fullText">
        <button type="button" class="ag-cs-add-off" aria-disabled="true">
          <Plus :size="14" aria-hidden="true" />
          Add entry
        </button>
      </AgTooltip>
      <AgButton v-else class="ag-cs-add" variant="ghost" size="xs" :icon="Plus" @click="emit('add', section.key)">
        Add entry
      </AgButton>
    </template>
  </section>
</template>

<style scoped>
.ag-cs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 16px;
}

.ag-cs-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ag-cs-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.ag-cs-title:focus {
  outline: none;
}

.ag-cs-help {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-cs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-cs :deep(.ag-cs-add) {
  align-self: flex-start;
  margin-left: -8px;
}

.ag-cs-add-off {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 6px;
  height: 26px;
  margin-left: -8px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-disabled);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: default;
}

.ag-cs-add-off:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
