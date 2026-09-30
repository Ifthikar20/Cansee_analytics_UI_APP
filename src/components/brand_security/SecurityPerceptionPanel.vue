<script setup>
/**
 * Security perception: what AI assistants say about the brand's security,
 * compliance, incident history and data handling.
 *
 * Every number here is perception, measured by cold probes (no crawled
 * context sent to the models) and checked against the brand's own
 * uploaded material. A model claiming a certification does not make it
 * real, and "unsupported" means the Brand Input material does not back
 * the claim, not that the claim is false. The copy keeps that distinction.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale,
} from 'chart.js'
import { Play, RefreshCw, ShieldAlert } from '@lucide/vue'

import brandSecurity from '@/api/brandSecurity'
import { useToast } from '@/composables/useToast'
import { cssVar } from '@/lib/theme'
import { timeAgo } from '@/utils/timeAgo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

ChartJS.register(Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale)

const props = defineProps({
  websiteId: { type: String, default: '' },
})
const emit = defineEmits(['show-findings'])

const toast = useToast()

const data = ref(null)
const loading = ref(false)
const starting = ref(false)
const days = ref(90)

const WINDOWS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
  { value: 0, label: 'All time' },
]

const PROVIDER_LABELS = {
  claude: 'Claude',
  gpt4: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  grok: 'Grok',
  deepseek: 'DeepSeek',
}

const DETECTOR_LABELS = {
  'BS-SEC-001': 'Unsupported compliance claims',
  'BS-SEC-002': 'Unconfirmed incidents',
  'BS-SEC-003': 'Advised against',
  'BS-PRIV-001': 'Private data exposure',
}

const KIND_LABELS = {
  certification: 'Certifications and compliance',
  incident: 'Incidents and vulnerabilities',
  encryption: 'Encryption',
  access_control: 'Access control',
  privacy: 'Privacy and data handling',
  vulnerability: 'Weaknesses and patching',
  other: 'Other',
}

// ── Loading + polling ───────────────────────────────────────────────────

let pollTimer = null

async function load({ silent = false } = {}) {
  if (!props.websiteId) return
  if (!silent) loading.value = true
  try {
    const { data: payload } = await brandSecurity.perception(props.websiteId, { days: days.value })
    data.value = payload
    schedulePoll()
  } catch {
    if (!silent) toast.error('Could not load security perception')
  } finally {
    loading.value = false
  }
}

// While a probe is pending or running, re-read every few seconds so the
// numbers land without a manual refresh. Stops on its own once idle.
function schedulePoll() {
  clearPoll()
  if (data.value?.active_probe) {
    pollTimer = setTimeout(() => load({ silent: true }), 5000)
  }
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

onMounted(load)
onBeforeUnmount(clearPoll)
watch(() => props.websiteId, () => load())
watch(days, () => load())

async function runProbe() {
  starting.value = true
  try {
    await brandSecurity.runProbe(props.websiteId)
    toast.success('Security probe started')
    await load({ silent: true })
  } catch (err) {
    const detail = err?.response?.data?.detail || err?.response?.data?.error
    toast.error(detail || 'Could not start a security probe')
  } finally {
    starting.value = false
  }
}

// ── Derived ─────────────────────────────────────────────────────────────

const hasProbes = computed(() => (data.value?.probes || 0) > 0)
const active = computed(() => data.value?.active_probe || null)

function pct(value) {
  return value === null || value === undefined ? '–' : `${value}%`
}

const tiles = computed(() => {
  const d = data.value
  if (!d) return []
  const m = d.mention_rate || {}
  const c = d.claims || {}
  return [
    {
      key: 'mention',
      label: 'Brand named in answers',
      value: pct(m.smoothed),
      note: m.n
        ? `${m.mentioned} of ${m.n} answers · 95% interval ${m.ci_lower}–${m.ci_upper}%`
        : 'No answers yet',
    },
    {
      key: 'accuracy',
      label: 'Claims backed by your material',
      value: pct(c.accuracy),
      note: c.scored
        ? `${c.supported} of ${c.scored} affirmed claims matched Brand Input`
        : 'No scored claims yet',
    },
    {
      key: 'compliance',
      label: 'Unsupported compliance claims',
      value: String(d.hallucinated_compliance ?? 0),
      note: 'Certifications or controls stated for you that your material does not back',
      alert: (d.hallucinated_compliance ?? 0) > 0,
    },
    {
      key: 'incidents',
      label: 'Incidents attributed to you',
      value: String(d.incident_claims ?? 0),
      note: `${d.unconfirmed_incidents ?? 0} not confirmed by your material`,
      alert: (d.unconfirmed_incidents ?? 0) > 0,
    },
    {
      key: 'fud',
      label: 'Fear framing',
      value: pct(d.fud_rate),
      note: 'Answers using "risky", "be careful", "cannot be trusted" about you',
      alert: (d.fud_rate ?? 0) > 0,
    },
    {
      key: 'against',
      label: 'Advised against',
      value: pct(d.recommends_against_rate),
      note: 'Answers steering the reader away from you on security grounds',
      alert: (d.recommends_against_rate ?? 0) > 0,
    },
    {
      key: 'leakage',
      label: 'Private data exposure',
      value: pct(d.leakage_rate),
      note: 'Answers where non-public data about you surfaced',
      alert: (d.leakage_rate ?? 0) > 0,
    },
  ]
})

const byModel = computed(() =>
  (data.value?.by_model || []).map((row) => ({
    ...row,
    label: PROVIDER_LABELS[row.provider] || row.provider,
  })),
)

const findings = computed(() => {
  const open = data.value?.open_findings || {}
  return Object.entries(DETECTOR_LABELS).map(([code, label]) => ({
    code, label, count: open[code] || 0,
  }))
})

const openFindingsTotal = computed(() =>
  findings.value.reduce((sum, f) => sum + f.count, 0),
)

const claimsByKind = computed(() => {
  const kinds = data.value?.claims?.by_kind || {}
  return Object.entries(kinds).map(([kind, counts]) => ({
    kind,
    label: KIND_LABELS[kind] || kind,
    claims: counts.claims || 0,
    supported: counts.supported || 0,
    unsupported: counts.unsupported || 0,
  }))
})

const trustShare = computed(() => {
  const ts = data.value?.trust_share
  if (!ts || !ts.brands || !Object.keys(ts.brands).length) return []
  return Object.entries(ts.brands)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, strength]) => ({
      name,
      strength,
      isBrand: name.toLowerCase() === (data.value?.brand_name || '').toLowerCase(),
    }))
})

const hasTrend = computed(() => (data.value?.trend || []).length >= 2)

function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const chartData = computed(() => {
  const trend = data.value?.trend || []
  const c1 = cssVar('--chart-1', '#5b8def')
  const c2 = cssVar('--chart-2', '#22c55e')
  const c3 = cssVar('--chart-3', '#f59e0b')
  const common = {
    fill: false,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2,
    spanGaps: true,
  }
  return {
    labels: trend.map((t) => shortDate(t.completed_at)),
    datasets: [
      { ...common, label: 'Named in answers', data: trend.map((t) => t.mention_rate), borderColor: c1, backgroundColor: c1 },
      { ...common, label: 'Claims backed', data: trend.map((t) => t.claim_accuracy), borderColor: c2, backgroundColor: c2 },
      { ...common, label: 'Fear framing', data: trend.map((t) => t.fud_rate), borderColor: c3, backgroundColor: c3 },
    ],
  }
})

const chartOptions = computed(() => {
  const grid = cssVar('--border', 'rgba(0,0,0,0.08)')
  const text = cssVar('--muted-foreground', '#64748b')
  const popover = cssVar('--popover', '#ffffff')
  const popoverFg = cssVar('--popover-foreground', '#0f172a')
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: text, usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        usePointStyle: true,
        backgroundColor: popover,
        titleColor: popoverFg,
        bodyColor: popoverFg,
        borderColor: grid,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y === null ? 'n/a' : ctx.parsed.y + '%'}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: text, font: { size: 12 } } },
      y: { min: 0, max: 100, grid: { color: grid }, border: { display: false }, ticks: { color: text, callback: (v) => `${v}%` } },
    },
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header row -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="max-w-2xl">
        <h2 class="text-base font-bold text-foreground">Security perception</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          What AI assistants tell buyers about
          <span class="font-medium text-foreground">{{ data?.brand_name || 'your brand' }}</span>'s
          security, compliance, incident history and data handling. Probes ask the models cold,
          with none of your site context, and check each claim against your Brand Input material.
          This measures perception, not your actual security posture.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model.number="days"
          aria-label="Time window"
          class="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option v-for="w in WINDOWS" :key="w.value" :value="w.value">{{ w.label }}</option>
        </select>
        <Button variant="outline" size="sm" :disabled="loading" @click="load()">
          <RefreshCw class="size-3.5" :class="loading ? 'animate-spin' : ''" />
          Refresh
        </Button>
        <Button size="sm" :disabled="starting || Boolean(active)" @click="runProbe">
          <Play class="size-3.5" />
          {{ active ? 'Probe running' : 'Run security probe' }}
        </Button>
      </div>
    </div>

    <!-- Active probe banner -->
    <div
      v-if="active"
      class="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm"
    >
      <span class="size-2 animate-pulse rounded-full bg-[color:var(--chart-2)]" aria-hidden="true"></span>
      <span class="text-foreground">
        Probe {{ active.status }} ·
        {{ active.queries_completed }} of {{ active.total_queries || '?' }} queries answered.
      </span>
      <span class="text-muted-foreground">Results update automatically.</span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading && !data" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>

    <!-- Empty state -->
    <Card v-else-if="data && !hasProbes && !active" class="border-dashed">
      <CardContent class="pt-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="rounded-lg bg-secondary p-2.5">
              <ShieldAlert class="size-5 text-foreground" />
            </div>
            <div>
              <h3 class="text-base font-bold text-foreground">No security probe yet</h3>
              <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
                A probe asks every configured model the questions a security reviewer would ask
                about {{ data.brand_name || 'your brand' }}: certifications, breaches, encryption,
                data handling, and whether they would recommend you. Add your trust page or security
                documentation on Brand Ingestion first so claims can be checked against it.
              </p>
            </div>
          </div>
          <Button :disabled="starting" @click="runProbe">
            <Play class="size-3.5" />
            Run first probe
          </Button>
        </div>
      </CardContent>
    </Card>

    <template v-else-if="data">
      <!-- KPI tiles -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card v-for="tile in tiles" :key="tile.key">
          <CardContent class="pt-5">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {{ tile.label }}
            </p>
            <p
              class="mt-1 text-2xl font-bold tabular-nums"
              :class="tile.alert ? 'text-severity-high' : 'text-foreground'"
            >{{ tile.value }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ tile.note }}</p>
          </CardContent>
        </Card>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Trend -->
        <Card class="lg:col-span-2">
          <CardHeader>
            <CardTitle>Per probe</CardTitle>
            <CardDescription>
              {{ data.probes }} probe{{ data.probes === 1 ? '' : 's' }} in this window ·
              last {{ data.last_probe_at ? timeAgo(data.last_probe_at) : 'never' }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="hasTrend" class="h-64">
              <Line :data="chartData" :options="chartOptions" />
            </div>
            <p v-else class="py-8 text-center text-sm text-muted-foreground">
              Trends appear after the second probe.
            </p>
          </CardContent>
        </Card>

        <!-- Open security findings -->
        <Card>
          <CardHeader>
            <CardTitle>Open security findings</CardTitle>
            <CardDescription>Raised from these answers, judged against your material</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <button
              v-for="f in findings"
              :key="f.code"
              type="button"
              class="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click="emit('show-findings', f.code)"
            >
              <span class="text-foreground">{{ f.label }}</span>
              <span
                class="font-bold tabular-nums"
                :class="f.count ? 'text-severity-high' : 'text-muted-foreground'"
              >{{ f.count }}</span>
            </button>
            <p v-if="!openFindingsTotal" class="pt-1 text-xs text-muted-foreground">
              Nothing open. Findings need Brand Input material to be confirmed against.
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Per model -->
        <Card class="lg:col-span-2">
          <CardHeader>
            <CardTitle>By model</CardTitle>
            <CardDescription>Which assistants get it right and which steer buyers away</CardDescription>
          </CardHeader>
          <CardContent>
            <table v-if="byModel.length" class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th class="pb-2 pr-3">Model</th>
                  <th class="pb-2 pr-3 text-right">Answers</th>
                  <th class="pb-2 pr-3 text-right">Named</th>
                  <th class="pb-2 pr-3 text-right">Claims backed</th>
                  <th class="pb-2 pr-3 text-right">Fear framing</th>
                  <th class="pb-2 text-right">Advised against</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in byModel" :key="row.provider" class="border-t border-border">
                  <td class="py-2 pr-3 font-medium text-foreground">{{ row.label }}</td>
                  <td class="py-2 pr-3 text-right tabular-nums">{{ row.responses }}</td>
                  <td class="py-2 pr-3 text-right tabular-nums">{{ pct(row.mention_rate) }}</td>
                  <td class="py-2 pr-3 text-right tabular-nums">{{ pct(row.claim_accuracy) }}</td>
                  <td class="py-2 pr-3 text-right tabular-nums" :class="row.fud_rate ? 'text-severity-high' : ''">{{ pct(row.fud_rate) }}</td>
                  <td class="py-2 text-right tabular-nums" :class="row.recommends_against_rate ? 'text-severity-high' : ''">{{ pct(row.recommends_against_rate) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-6 text-center text-sm text-muted-foreground">No answers in this window.</p>
          </CardContent>
        </Card>

        <!-- Trust share -->
        <Card>
          <CardHeader>
            <CardTitle>Trust share</CardTitle>
            <CardDescription>Who the models rank as the safer choice (latest probe)</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <div v-for="b in trustShare" :key="b.name" class="flex items-center gap-2 text-sm">
              <span class="w-28 truncate" :class="b.isBrand ? 'font-semibold text-foreground' : 'text-muted-foreground'">
                {{ b.name }}<span v-if="b.isBrand" class="ml-1 text-xs text-muted-foreground">(you)</span>
              </span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full"
                  :class="b.isBrand ? 'bg-[color:var(--chart-1)]' : 'bg-[color:var(--chart-4)]'"
                  :style="{ width: `${Math.round(b.strength * 100)}%` }"
                ></div>
              </div>
              <span class="w-10 text-right text-xs tabular-nums text-muted-foreground">{{ Math.round(b.strength * 100) }}</span>
            </div>
            <p v-if="!trustShare.length" class="text-xs text-muted-foreground">
              Appears once answers rank you against other vendors.
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Claims by kind -->
      <Card v-if="claimsByKind.length">
        <CardHeader>
          <CardTitle>What the models claim about you</CardTitle>
          <CardDescription>
            Statements extracted from answers, by topic. "Backed" means a close match in your Brand Input material;
            "unsupported" means no match, which is a gap in your material as often as an error by the model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th class="pb-2 pr-3">Topic</th>
                <th class="pb-2 pr-3 text-right">Claims</th>
                <th class="pb-2 pr-3 text-right">Backed</th>
                <th class="pb-2 text-right">Unsupported</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in claimsByKind" :key="row.kind" class="border-t border-border">
                <td class="py-2 pr-3 text-foreground">{{ row.label }}</td>
                <td class="py-2 pr-3 text-right tabular-nums">{{ row.claims }}</td>
                <td class="py-2 pr-3 text-right tabular-nums">{{ row.supported }}</td>
                <td class="py-2 text-right tabular-nums" :class="row.unsupported ? 'text-severity-high' : ''">{{ row.unsupported }}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p v-if="data.heuristic_share" class="text-xs text-muted-foreground">
        {{ data.heuristic_share }}% of answers were analysed by the fallback heuristic because the
        extraction model was unavailable. Their claims are coarser.
      </p>
    </template>
  </div>
</template>
