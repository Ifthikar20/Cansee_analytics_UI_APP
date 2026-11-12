<template>
  <ol v-if="actions.length" class="al">
    <li v-for="(a, i) in actions" :key="a.kind" class="al-item">
      <span class="al-num">{{ String(i + 1).padStart(2, '0') }}</span>
      <div class="al-body">
        <h3 class="al-title">{{ a.title }}</h3>
        <p class="al-detail">{{ a.detail }}</p>
        <div v-if="a.targets.length || a.engines.length" class="al-meta">
          <a
            v-for="t in a.targets"
            :key="t.url"
            :href="t.url"
            target="_blank"
            rel="noopener"
            class="al-target"
          >
            {{ t.label }}
            <ExternalLink class="al-ext" aria-hidden="true" />
          </a>
          <span v-for="key in a.engines" :key="key" class="al-engine">
            <span class="al-engine-dot" :style="{ background: engineMeta(key).color }" aria-hidden="true"></span>
            {{ engineMeta(key).label }}
          </span>
        </div>
      </div>
    </li>
  </ol>
  <p v-else class="al-empty">Nothing to change for this prompt right now.</p>
</template>

<script setup>
import { ExternalLink } from '@lucide/vue'
import { engineMeta } from '@/lib/engines'

defineProps({
  actions: { type: Array, required: true },
})
</script>

<style scoped>
.al {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.al-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  padding: 18px 0;
}

.al-item + .al-item {
  border-top: 1px dashed var(--border);
}

.al-num {
  color: var(--gap-ai);
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
  font-size: 13px;
  letter-spacing: 0.06em;
  padding-top: 2px;
}

.al-body {
  display: grid;
  gap: 6px;
}

.al-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.al-detail {
  max-width: 72ch;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.6;
}

.al-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.al-target {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 12.5px;
  font-weight: 500;
}

.al-target:hover {
  border-color: var(--input);
}

.al-ext {
  width: 12px;
  height: 12px;
  color: var(--muted-foreground);
}

.al-engine {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--radius);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12px;
}

.al-engine-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.al-empty {
  color: var(--muted-foreground);
  font-size: 14px;
}
</style>
