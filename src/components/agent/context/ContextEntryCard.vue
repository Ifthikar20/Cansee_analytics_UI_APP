<script setup>
// One context entry: its title, text and sources, and where it came from.
// A suggestion (built from the site) waits for Accept, Edit or Dismiss and
// the agents ignore it until then; an active entry has a menu. Entry text
// can quote pages, so it renders as text only.
import { computed, ref } from 'vue'
import { Check, Ellipsis, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import { relativeTime } from '@/components/agent/common/agentText'
import { CONTEXT_LIMITS } from '@/lib/agent/contextSections'
import ReferenceChip from './ReferenceChip.vue'

const props = defineProps({
  entry: { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
  // An accept or dismiss for this entry is in flight.
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['accept', 'dismiss', 'edit', 'add-source', 'delete'])

const menuOpen = ref(false)

const suggested = computed(() => props.entry.status === 'suggested')
const title = computed(() => String(props.entry.title || '').trim())
const label = computed(() => title.value || String(props.entry.body || '').trim().slice(0, 60) || 'this entry')
const references = computed(() => (Array.isArray(props.entry.references) ? props.entry.references : []))
const sourcesFull = computed(() => references.value.length >= CONTEXT_LIMITS.references)

const originLine = computed(() => {
  const e = props.entry
  const when = relativeTime(e.updated_at)
  if (suggested.value) return when ? `Suggested from your site ${when}` : 'Suggested from your site'
  // A moved entry nobody has edited since (revision 1).
  if (e.origin === 'migrated' && !(Number(e.revision) > 1)) return 'Moved from the earlier context'
  if (e.updated_by_name) return when ? `Updated by ${e.updated_by_name} ${when}` : `Updated by ${e.updated_by_name}`
  return ''
})
</script>

<template>
  <article class="ag-cec" :class="{ 'is-suggested': suggested }" :data-entry="entry.id">
    <div class="ag-cec-head">
      <h3 v-if="title" class="ag-cec-title">{{ title }}</h3>
      <DropdownMenuRoot v-if="canEdit && !suggested" v-model:open="menuOpen" :modal="false">
        <DropdownMenuTrigger as-child>
          <AgIconButton class="ag-cec-more" :label="`More actions for ${label}`" :size="28" muted>
            <Ellipsis />
          </AgIconButton>
        </DropdownMenuTrigger>
        <AgMenuContent align="end" :width="168">
          <AgMenuItem @select="emit('edit')">
            <Pencil aria-hidden="true" />
            Edit
          </AgMenuItem>
          <AgMenuItem :disabled="sourcesFull" @select="emit('add-source')">
            <Plus aria-hidden="true" />
            Add source
          </AgMenuItem>
          <AgMenuItem @select="emit('delete')">
            <Trash2 aria-hidden="true" />
            Delete
          </AgMenuItem>
        </AgMenuContent>
      </DropdownMenuRoot>
    </div>

    <p v-if="entry.body" class="ag-cec-body">{{ entry.body }}</p>

    <ul v-if="references.length" class="ag-cec-sources" role="list" aria-label="Sources">
      <li v-for="r in references" :key="r.id">
        <ReferenceChip :reference="r" />
      </li>
    </ul>

    <div class="ag-cec-foot">
      <p v-if="originLine" class="ag-cec-origin">{{ originLine }}</p>
      <div v-if="canEdit && suggested" class="ag-cec-actions">
        <AgButton size="xs" variant="primary" :icon="Check" :disabled="busy" @click="emit('accept')">Accept</AgButton>
        <AgButton size="xs" :icon="Pencil" :disabled="busy" @click="emit('edit')">Edit</AgButton>
        <AgButton size="xs" variant="ghost" :icon="X" :disabled="busy" @click="emit('dismiss')">Dismiss</AgButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
.ag-cec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  background: var(--ag-pane-bg);
}

.ag-cec.is-suggested {
  border-style: dashed;
  background: var(--ag-bubble-bg);
}

.ag-cec-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ag-cec-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.ag-cec-head :deep(.ag-cec-more) {
  flex-shrink: 0;
  margin: -4px -6px 0 auto;
}

.ag-cec-body {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-cec-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-cec-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.ag-cec-origin {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-cec-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}
</style>
