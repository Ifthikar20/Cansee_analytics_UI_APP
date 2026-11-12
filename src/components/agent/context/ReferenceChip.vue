<script setup>
// One source of a context entry: an icon for its kind, its label (a page's
// path, a fact, a document title or a competitor), a link for pages, the
// quoted words in a tooltip, and a warning word when the source changed or
// could not be checked. In a form it gets a remove button.
import { computed } from 'vue'
import { CircleAlert, ExternalLink, X } from '@lucide/vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { REFERENCE_KINDS, REFERENCE_STATE_WORDS, pathOf } from '@/lib/agent/contextSections'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  // Reference {id, kind, label, url, quote, state}
  reference: { type: Object, required: true },
  removable: { type: Boolean, default: false },
})

const emit = defineEmits(['remove'])

const kind = computed(() => REFERENCE_KINDS[props.reference.kind] || REFERENCE_KINDS.page)
const label = computed(() => {
  const r = props.reference
  if (r.label) return r.label
  if (r.kind === 'page') return pathOf(r.url) || r.url || 'Page'
  return kind.value.label
})
const href = computed(() => (props.reference.kind === 'page' ? safeHref(props.reference.url || '') : ''))
const stateWord = computed(() => REFERENCE_STATE_WORDS[props.reference.state] || '')
const quote = computed(() => (props.reference.quote ? `"${props.reference.quote}"` : ''))
</script>

<template>
  <span class="ag-ref" :class="{ 'is-warn': stateWord }">
    <span class="ag-ref-main">
      <component :is="kind.icon" :size="13" class="ag-ref-icon" aria-hidden="true" />
      <!-- The quote shows on hover and on keyboard focus of the label itself. -->
      <AgTooltip :text="quote" :disabled="!quote">
        <a v-if="href" :href="href" class="ag-ref-label is-link" target="_blank" rel="noopener noreferrer nofollow">
          {{ label }}
          <ExternalLink :size="11" aria-hidden="true" />
          <span class="ag-sr-only">(opens in a new tab)</span>
        </a>
        <span v-else class="ag-ref-label" :tabindex="quote ? 0 : undefined">{{ label }}</span>
      </AgTooltip>
    </span>
    <span v-if="stateWord" class="ag-ref-state">
      <CircleAlert :size="12" aria-hidden="true" />
      {{ stateWord }}
    </span>
    <button v-if="removable" type="button" class="ag-ref-remove" :aria-label="`Remove ${label}`" @click="emit('remove')">
      <X :size="12" aria-hidden="true" />
    </button>
  </span>
</template>

<style scoped>
.ag-ref {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 26px;
  box-sizing: border-box;
  padding: 2px 8px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  background: var(--ag-pane-bg);
  color: var(--ag-fg-2);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-ref-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.ag-ref-label[tabindex]:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-ref-icon {
  flex-shrink: 0;
  color: var(--ag-fg-3);
}

.ag-ref-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-ref-label.is-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ag-fg-1);
  text-decoration: none;
}

.ag-ref-label.is-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 1;
}

.ag-ref-label.is-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-ref-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ag-warning);
}

.ag-ref-remove {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-right: -4px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-3);
  cursor: pointer;
}

.ag-ref-remove:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-ref-remove:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}
</style>
