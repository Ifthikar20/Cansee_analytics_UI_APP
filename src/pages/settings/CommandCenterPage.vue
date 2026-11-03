<template>
  <SettingsShell active="command-center">
    <div class="cc-page">
      <AnalyticsHeader eyebrow="Workspace" title="Usage dashboard" :subtitle="subtitle" />

      <FilterRow>
        <AnSelect v-if="scopeOptions.length > 1" v-model="scopeModel" label="Scope" :options="scopeOptions" />
        <AnSelect v-model="project" label="Project" :options="projectOptions" />
        <PeriodSelect v-model="period" />
      </FilterRow>

      <!-- First load: the header and filters are already up. -->
      <div v-if="!data && !error" class="cc-skeleton" aria-busy="true" aria-label="Loading the usage dashboard">
        <div class="cc-kpis">
          <Skeleton v-for="n in 5" :key="n" class="h-28 rounded-2xl" />
        </div>
        <Skeleton class="h-72 rounded-2xl" />
        <Skeleton class="h-72 rounded-2xl" />
      </div>

      <VizState
        v-else-if="!data"
        kind="error"
        title="We couldn't load the usage dashboard."
        :action="{ label: 'Try again' }"
        @action="reload"
      />

      <template v-else>
        <!-- A refresh failed: the numbers below are from the last good load. -->
        <Alert v-if="stale" variant="destructive" class="cc-alert">
          <CircleX />
          <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
          <AlertDescription>
            <button type="button" class="cc-retry" @click="reload">Try again</button>
          </AlertDescription>
        </Alert>

        <VizState v-if="pageEmpty" v-bind="pageEmpty" />

        <template v-else>
          <section class="cc-kpis" aria-label="Key numbers">
            <VizStatTile
              v-for="tile in tiles"
              :key="tile.key"
              :label="tile.label"
              :value="tile.value"
              :kind="tile.kind"
              :delta="tile.delta"
            />
          </section>

          <VizChart :spec="specs.runs" :loading="loading" :height="260" :heading-level="2" />

          <div class="cc-two">
            <VizChart :spec="specs.users" :loading="loading" :heading-level="2" />
            <VizChart :spec="specs.teams" :loading="loading" :heading-level="2" />
          </div>

          <VizChart :spec="specs.spend" :loading="loading" :height="260" :heading-level="2" />

          <VizChart :spec="specs.agents" :loading="loading" :heading-level="2" />

          <section v-if="topUsers" class="cc-users" aria-labelledby="cc-users-title">
            <h2 id="cc-users-title" class="cc-users-title">Top users</h2>
            <div class="cc-table-wrap" tabindex="0" aria-label="Top users, scrolls sideways">
              <table class="cc-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col" class="is-num">Runs</th>
                    <th scope="col" class="is-num">Active days</th>
                    <th scope="col" class="is-num">AI spend</th>
                    <th scope="col">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in topUsers" :key="row.key">
                    <th scope="row" class="cc-user">
                      <span class="cc-user-name">{{ row.name }}</span>
                      <span v-if="row.email" class="cc-user-email">{{ row.email }}</span>
                    </th>
                    <td>{{ row.role }}</td>
                    <td class="is-num">{{ row.runs }}</td>
                    <td class="is-num">{{ row.active_days }}</td>
                    <td class="is-num">{{ row.ai_usd }}</td>
                    <td>
                      <time v-if="row.last_active_at" :datetime="row.last_active_at">{{ timeAgo(row.last_active_at) }}</time>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
    </div>
  </SettingsShell>
</template>

<script setup>
// The usage dashboard (the Command Center design, p2_contract.md 14): agent
// runs, active users, drafts saved and AI spend from recorded runs and the
// usage ledger, for the signed-in user or, for organization owners and
// admins, the whole organization. Filters live in the URL query.
import { computed, watch } from 'vue'
import { CircleX } from '@lucide/vue'
import agentApi from '@/api/agent'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useQueryState } from '@/composables/analytics/useQueryState'
import {
  activeUsersOverTime, commandEmpty, commandTiles, runsByAgent, runsByTeam, runsOverTime, spendOverTime, topUserRows,
} from '@/lib/analytics/commandSpecs'
import { relativeTime } from '@/components/agent/common/agentText'
import SettingsShell from '@/components/settings/SettingsShell.vue'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import AnSelect from '@/components/analytics/AnSelect.vue'
import FilterRow from '@/components/analytics/FilterRow.vue'
import PeriodSelect from '@/components/analytics/PeriodSelect.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

const { scope, project, period } = useQueryState(
  { scope: '', project: '', period: '30d' },
  { allowed: { scope: ['me', 'org'], period: ['7d', '30d', '90d'] } },
)

const params = computed(() => {
  const p = { period: period.value }
  if (scope.value) p.scope = scope.value
  if (project.value) p.website_id = project.value
  return p
})

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => agentApi.commandCenter(params.value).then((res) => res.data),
  () => params.value,
  { resetOn: () => scope.value },
)

// A scope this user may not see (403), or a project outside the scope
// (404): drop that filter and show what the user can see.
watch(failure, (f) => {
  if (f?.status === 403 && scope.value) scope.value = ''
  else if (f?.status === 404 && project.value) project.value = ''
})

const scopes = computed(() => (Array.isArray(data.value?.scopes) ? data.value.scopes : []))
const shownScope = computed(() => data.value?.scope || scope.value || 'me')
const scopeOptions = computed(() => scopes.value.map((s) => ({ value: s.key, label: s.label })))
// The select shows the scope the server answered for (its default is the
// organization for owners and admins), so it never claims another one.
const scopeModel = computed({
  get: () => shownScope.value,
  set: (value) => {
    scope.value = value
  },
})

const projectOptions = computed(() => [
  { value: '', label: 'All projects' },
  ...(data.value?.websites || []).map((w) => ({ value: String(w.id), label: w.name || 'Untitled project' })),
])

const subtitle = computed(() => {
  if (shownScope.value === 'org') {
    const org = scopes.value.find((s) => s.key === 'org')?.label
    if (org) return `How ${org} uses the agents and the AI allowance, from recorded runs and usage.`
  }
  return 'How you use the agents and the AI allowance, from recorded runs and usage.'
})

const pageEmpty = computed(() => (data.value ? commandEmpty(data.value, period.value) : null))
const tiles = computed(() => commandTiles(data.value, { period: data.value?.window?.period || period.value }))

const specs = computed(() => {
  const d = data.value
  return {
    runs: runsOverTime(d),
    users: activeUsersOverTime(d),
    spend: spendOverTime(d),
    agents: runsByAgent(d),
    teams: runsByTeam(d),
  }
})

const topUsers = computed(() => topUserRows(data.value))

function timeAgo(iso) {
  return relativeTime(iso)
}
</script>

<style scoped>
/* minmax(0, 1fr): a wide chart or table never sets the page width. */
.cc-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.cc-skeleton {
  display: grid;
  gap: 16px;
}

.cc-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.cc-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cc-alert {
  border-radius: 14px;
}

.cc-retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.cc-users {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.cc-users-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
}

.cc-table-wrap {
  overflow-x: auto;
}

.cc-table-wrap:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.cc-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--foreground);
  font-size: 13.5px;
}

.cc-table th,
.cc-table td {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

.cc-table thead th {
  border-top: 0;
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 500;
}

.cc-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.cc-user {
  display: flex;
  flex-direction: column;
  font-weight: 500;
}

.cc-user-email {
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 400;
}

@media (max-width: 1100px) {
  .cc-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cc-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .cc-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
