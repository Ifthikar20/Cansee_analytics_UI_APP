<script setup>
// Which source the numbers below come from and what they count, with the
// source's own caveats (contract 4c `notes`) in muted lines under it.
import { computed } from 'vue'
import { Info } from '@lucide/vue'

const props = defineProps({
  sourceLabel: { type: String, default: '' },
  metricLabel: { type: String, default: '' },
  notes: { type: Array, default: () => [] },
  stale: { type: Boolean, default: false },
})

const STALE_PREFIX = 'Showing the last saved copy'

const lines = computed(() => {
  const out = props.notes.filter((n) => typeof n === 'string' && n)
  if (props.stale && !out.some((n) => n.startsWith(STALE_PREFIX))) {
    out.push(`${STALE_PREFIX}; ${props.sourceLabel} could not be reached.`)
  }
  return out
})
</script>

<template>
  <section class="an-banner" aria-label="Data source">
    <p class="an-banner-title">
      <span class="an-banner-source">{{ sourceLabel }}</span>
      <template v-if="metricLabel"><span class="an-banner-sep"> · </span>{{ metricLabel }}</template>
    </p>
    <ul v-if="lines.length" class="an-banner-notes">
      <li v-for="line in lines" :key="line">
        <Info class="an-banner-icon" aria-hidden="true" />
        <span>{{ line }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.an-banner {
  display: grid;
  gap: 6px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.an-banner-title {
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
}

.an-banner-source {
  font-weight: 600;
}

.an-banner-sep {
  color: var(--muted-foreground);
  white-space: pre;
}

.an-banner-notes {
  display: grid;
  gap: 4px;
  list-style: none;
}

.an-banner-notes li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.5;
}

.an-banner-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 3px;
}
</style>
