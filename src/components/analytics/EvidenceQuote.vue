<script setup>
// The evidence a verdict relied on (contract 3d `claims[].evidence`): the
// quote in quotation marks, where it comes from (a brand fact, or the page
// path as an external link) and the checker's one-sentence note.
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  // {kind: 'page' | 'fact', url, quote, fact}
  evidence: { type: Object, default: null },
  note: { type: String, default: '' },
})

const href = computed(() => (props.evidence?.kind === 'page' ? safeHref(props.evidence.url) : null))

const path = computed(() => {
  const url = props.evidence?.url
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch {
    return String(url)
  }
})
</script>

<template>
  <div class="eq">
    <p v-if="evidence?.quote" class="eq-quote">"{{ evidence.quote }}"</p>
    <p v-if="evidence?.kind === 'fact'" class="eq-source">Brand fact</p>
    <p v-else-if="evidence?.kind === 'page' && path" class="eq-source">
      <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" class="eq-link" :title="evidence.url">
        {{ path }}
        <ExternalLink class="eq-link-icon" aria-hidden="true" />
        <span class="sr-only">(opens in a new tab)</span>
      </a>
      <span v-else>{{ path }}</span>
    </p>
    <p v-if="note" class="eq-note">Checker's note: {{ note }}</p>
  </div>
</template>

<style scoped>
.eq {
  display: grid;
  gap: 3px;
  min-width: 0;
  font-size: 13px;
  line-height: 1.45;
}

.eq-quote {
  color: var(--foreground);
  overflow-wrap: anywhere;
}

.eq-source {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.eq-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
  overflow-wrap: anywhere;
}

.eq-link-icon {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.eq-note {
  color: var(--muted-foreground);
  font-size: 12px;
}
</style>
