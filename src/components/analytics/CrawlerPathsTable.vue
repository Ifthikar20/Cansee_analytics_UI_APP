<script setup>
// The pages AI crawlers request most (contract 4e `crawlers.paths`):
// path, requests and which crawlers asked for it.
import { computed } from 'vue'

const props = defineProps({
  // [{path, requests, bots: [bot keys]}]
  paths: { type: Array, default: () => [] },
  // The crawler catalog of the payload ([{key, name}]), for the names.
  bots: { type: Array, default: () => [] },
  title: { type: String, default: 'Most crawled pages' },
})

const integer = new Intl.NumberFormat('en-US')

const rows = computed(() => {
  const names = Object.fromEntries(props.bots.map((b) => [b.key, b.name]))
  return props.paths.map((p) => ({
    path: p.path,
    requests: typeof p.requests === 'number' ? integer.format(p.requests) : 'Not measured',
    crawlers: (p.bots || []).map((k) => names[k] || k).join(', '),
  }))
})
</script>

<template>
  <section class="cpt" aria-labelledby="cpt-title">
    <h3 id="cpt-title" class="cpt-title">{{ title }}</h3>
    <p v-if="!rows.length" class="cpt-empty">No pages were requested by AI crawlers in this window.</p>
    <div v-else class="cpt-scroll">
      <table class="cpt-table">
        <caption class="sr-only">{{ title }}</caption>
        <thead>
          <tr>
            <th scope="col">Path</th>
            <th scope="col" class="is-num">Requests</th>
            <th scope="col">Crawlers</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.path">
            <th scope="row" class="cpt-path">{{ row.path }}</th>
            <td class="is-num">{{ row.requests }}</td>
            <td class="cpt-bots">{{ row.crawlers }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.cpt {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.cpt-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.cpt-empty {
  color: var(--muted-foreground);
  font-size: 13px;
}

.cpt-scroll {
  overflow-x: auto;
}

.cpt-table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 13px;
}

.cpt-table th,
.cpt-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.cpt-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.cpt-table tbody tr:last-child > * {
  border-bottom: 0;
}

.cpt-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cpt-path {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.cpt-bots {
  color: var(--muted-foreground) !important;
}
</style>
