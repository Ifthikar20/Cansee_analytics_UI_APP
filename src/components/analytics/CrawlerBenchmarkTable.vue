<script setup>
// Your home page next to each tracked competitor's (p2_contract.md 5c,
// 5d): robots.txt and llms.txt states, what the main AI bots may do on the
// home page, and its checks. A competitor never audited reads "Not audited".
import { computed } from 'vue'
import { BENCHMARK_BOTS, benchmarkRows } from '@/lib/analytics/siteSpecs'

const props = defineProps({
  // benchmarkBrands(payload, tracked)
  brands: { type: Array, default: () => [] },
  // The payload's bot catalog: which bots are control tokens ("Opted out").
  bots: { type: Array, default: () => [] },
  title: { type: String, default: 'Home pages compared' },
})

const rows = computed(() => benchmarkRows(props.brands, props.bots))
const columns = BENCHMARK_BOTS
</script>

<template>
  <div class="cbt-scroll" tabindex="0" role="region" :aria-label="`${title}, scrolls sideways`">
    <table class="cbt-table">
      <caption class="sr-only">{{ title }}</caption>
      <thead>
        <tr>
          <th scope="col">Brand</th>
          <th scope="col">robots.txt</th>
          <th scope="col">llms.txt</th>
          <th v-for="c in columns" :key="c.key" scope="col">{{ c.token }}</th>
          <th scope="col" class="is-num">Home page checks</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" :class="{ 'is-you': row.key === 'you' }">
          <th scope="row">{{ row.name }}</th>
          <td>{{ row.robots }}</td>
          <td>{{ row.llms }}</td>
          <td v-for="c in columns" :key="c.key">{{ row.bots[c.key] }}</td>
          <td class="is-num">{{ row.checks }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cbt-scroll {
  overflow-x: auto;
}

.cbt-scroll:focus-visible {
  border-radius: var(--radius);
}

.cbt-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 13px;
}

.cbt-table th,
.cbt-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

.cbt-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.cbt-table tbody tr:last-child > * {
  border-bottom: 0;
}

.cbt-table tbody th {
  font-weight: 500;
}

.cbt-table tr.is-you th {
  font-weight: 600;
}

.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cbt-table th.is-num {
  text-align: right;
}
</style>
