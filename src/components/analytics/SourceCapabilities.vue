<script setup>
// What each traffic source can measure (contract 4b `sources`), in words:
// every source measures something different, and a number only means
// what its source counts. Used on the Traffic page and in Settings >
// Connections (where the "Manage connections" link would point at itself).
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps({
  sources: { type: Array, default: () => [] },
})

const ORDER = ['pixel', 'ga4', 'ga_hosted', 'cloudflare']

const VISITORS = {
  visitors: 'Unique visitors',
  users: 'Users',
  live_only: 'Live only (last 30 minutes)',
  requests: 'Requests (bots included)',
}

function statusText(source) {
  switch (source.status) {
    case 'ok':
      return 'Connected'
    case 'not_installed':
      // The pixel reports not_installed both before it is verified and when
      // it is verified but has recorded nothing yet.
      return source.connected ? 'Installed, no visits yet' : 'Not installed'
    case 'pending_selection':
      return source.key === 'cloudflare' ? 'Choose a zone' : 'Choose a property'
    case 'disabled':
      return 'Turned off'
    case 'error':
      return 'Connection error'
    default:
      return 'Not connected'
  }
}

function yesNo(value) {
  return value === true ? 'Yes' : 'No'
}

// Cloudflare's crawler query depends on the zone's plan: unknown until a
// connected zone is probed, and only "possible" before one is connected.
function crawlersText(source) {
  const value = source.measures?.ai_crawlers
  if (value === 'unknown') return source.status === 'ok' ? 'Checking...' : 'If the plan allows'
  return yesNo(value)
}

const rows = computed(() =>
  [...props.sources]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((s) => ({
      key: s.key,
      label: s.label,
      status: statusText(s),
      ok: s.status === 'ok',
      visitors: VISITORS[s.measures?.visitors] || 'No',
      countries: yesNo(s.measures?.countries),
      aiVisits: yesNo(s.measures?.ai_referrals),
      aiCrawlers: crawlersText(s),
    })),
)

function rank(key) {
  const i = ORDER.indexOf(key)
  return i === -1 ? ORDER.length : i
}

const route = useRoute()
const showManage = computed(() => route?.name !== 'settings-connections')
</script>

<template>
  <div class="scap">
    <div class="scap-scroll">
      <table class="scap-table">
        <caption class="sr-only">What each traffic source can measure</caption>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th scope="col">Visitors</th>
            <th scope="col">Countries</th>
            <th scope="col">AI visits</th>
            <th scope="col">AI crawlers</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <th scope="row" class="scap-name">{{ row.label }}</th>
            <td>
              <span class="scap-status" :class="{ 'is-ok': row.ok }">
                <span class="scap-dot" aria-hidden="true"></span>
                {{ row.status }}
              </span>
            </td>
            <td>{{ row.visitors }}</td>
            <td :class="{ 'scap-no': row.countries === 'No' }">{{ row.countries }}</td>
            <td :class="{ 'scap-no': row.aiVisits === 'No' }">{{ row.aiVisits }}</td>
            <td :class="{ 'scap-no': row.aiCrawlers === 'No' }">{{ row.aiCrawlers }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="showManage" class="scap-foot">
      <Button as-child variant="outline" size="sm" class="rounded-full">
        <router-link :to="{ name: 'settings-connections' }">Manage connections</router-link>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.scap {
  display: grid;
  gap: 12px;
}

.scap-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.scap-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13px;
}

.scap-table th,
.scap-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}

.scap-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.scap-table tbody tr:last-child > * {
  border-bottom: 0;
}

.scap-name {
  color: var(--foreground);
  font-weight: 600;
  white-space: nowrap;
}

.scap-table td {
  color: var(--foreground);
}

.scap-no {
  color: var(--muted-foreground) !important;
}

.scap-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.scap-status.is-ok {
  color: var(--foreground);
}

.scap-dot {
  width: 7px;
  height: 7px;
  border: 1px solid var(--muted-foreground);
  border-radius: 50%;
}

.scap-status.is-ok .scap-dot {
  border-color: var(--gap-strong);
  background: var(--gap-strong);
}

.scap-foot {
  display: flex;
  justify-content: flex-start;
}
</style>
