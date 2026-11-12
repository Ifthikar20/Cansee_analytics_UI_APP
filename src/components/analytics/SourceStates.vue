<script setup>
// Where a page's numbers come from and whether each source is on: a row of
// "{label}: {word}" chips ("AI visits: Cansee pixel", "Audit: Not run").
// A chip with a note shows it in a tooltip on hover and keyboard focus.
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps({
  // [{ key, label, word, ok?: boolean, note?: string }]
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Data sources' },
})
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <ul class="ss" role="list" :aria-label="label">
      <li v-for="item in items" :key="item.key" class="ss-item">
        <Tooltip v-if="item.note">
          <TooltipTrigger as-child>
            <button type="button" class="ss-chip" :class="{ 'is-on': item.ok }">
              <span class="ss-dot" aria-hidden="true"></span>
              {{ item.label }}: {{ item.word }}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" class="max-w-72 whitespace-normal leading-relaxed">{{ item.note }}</TooltipContent>
        </Tooltip>
        <span v-else class="ss-chip" :class="{ 'is-on': item.ok }">
          <span class="ss-dot" aria-hidden="true"></span>
          {{ item.label }}: {{ item.word }}
        </span>
      </li>
    </ul>
  </TooltipProvider>
</template>

<style scoped>
.ss {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
}

.ss-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
}

.ss-chip.is-on {
  color: var(--foreground);
}

button.ss-chip {
  cursor: help;
}

button.ss-chip:hover {
  border-color: var(--input);
}

button.ss-chip:focus-visible {
  border-radius: var(--radius);
}

/* Filled for a source that is on, hollow otherwise; the word says which. */
.ss-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border: 1px solid var(--muted-foreground);
  border-radius: 50%;
}

.ss-chip.is-on .ss-dot {
  border-color: var(--viz-good);
  background: var(--viz-good);
}
</style>
