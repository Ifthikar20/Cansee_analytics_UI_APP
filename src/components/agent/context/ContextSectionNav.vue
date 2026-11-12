<script setup>
// The six sections at a glance: active entries and distinct sources per
// section, and how many suggestions wait. Each card jumps to its section.
import { plural, sectionCountLine } from '@/lib/agent/contextSections'

defineProps({
  // [{key, label, entries, suggested, references}] in contract order
  sections: { type: Array, required: true },
})

function jump(event, key) {
  const target = document.getElementById(`ctx-${key}`)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const heading = target.querySelector('h2')
  if (heading) {
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }
}
</script>

<template>
  <nav class="ag-csn" aria-label="Context sections">
    <ul class="ag-csn-list" role="list">
      <li v-for="s in sections" :key="s.key">
        <a :href="`#ctx-${s.key}`" class="ag-csn-card" @click="jump($event, s.key)">
          <span class="ag-csn-label">{{ s.label }}</span>
          <span class="ag-csn-count ag-tnum">{{ sectionCountLine(s) }}</span>
          <span v-if="s.suggested" class="ag-csn-badge ag-tnum">{{ plural(s.suggested, 'suggested', 'suggested') }}</span>
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.ag-csn-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-csn-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  box-sizing: border-box;
  height: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  color: var(--ag-fg-1);
  text-decoration: none;
  transition: background-color 120ms ease;
}

.ag-csn-card:hover {
  background: var(--ag-row-hover);
  opacity: 1;
}

.ag-csn-card:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
}

.ag-csn-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-csn-count {
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-csn-badge {
  margin-top: 4px;
  padding: 0 7px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--ag-accent) 12%, transparent);
  color: var(--ag-accent);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

@media (max-width: 767px) {
  .ag-csn-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
