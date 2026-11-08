<script setup>
// The run dialog of every insights kind (p2_contract.md 1e, frontend 1b):
// the kind's controls, the server's estimate 300 ms after every change, and
// a start that sends the estimate's own `confirm`. Nothing runs until the
// user confirms; if the cost moved meanwhile (409 estimate_changed) the new
// estimate replaces the old one and the user confirms again.
//
// The logic is the page's useInsightRun(kind): the dialog finds it by kind
// (or takes it as `runner`). Open it with runner.open(params), or bind
// v-model:open and pass the page's selection as `params`. The `controls`
// slot ({ params, update, options, estimate }) replaces the built-in
// controls of a kind.
import { computed, watch } from 'vue'
import { CircleAlert, Info, X } from '@lucide/vue'
import {
  DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle,
} from 'reka-ui'
import { injectInsightRun } from '@/composables/analytics/useInsightRun'
import { money } from '@/lib/analytics/countrySpecs'
import { useHideUsd } from '@/composables/useHideUsd'
import { estimateRuns } from '@/lib/promptRuns'
import { useAppStore } from '@/stores/app'
import { timeAgo } from '@/utils/timeAgo'
import PeriodSelect from './PeriodSelect.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  // answer_analysis | site_audit | prompt_research | fanout_google | shopping_check
  kind: { type: String, required: true },
  // The page's selection: the params the dialog opens with.
  params: { type: Object, default: null },
  open: { type: Boolean, default: undefined },
  // A useInsightRun(kind) to use instead of the page's.
  runner: { type: Object, default: null },
  // What the run options don't carry: { products: [{id, name}], engines: [{key, label, configured}], domain }.
  extra: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'started'])

const injected = injectInsightRun(props.kind)
const r = computed(() => props.runner || injected)
const app = useAppStore()
const integer = new Intl.NumberFormat('en-US')

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 }
const GOOGLE_KINDS = new Set(['prompt_research', 'fanout_google', 'shopping_check'])

const COPY = {
  answer_analysis: {
    title: 'Analyze AI answers',
    description:
      'Cansee reads each answer that names you, lists the claims it makes and how it describes you, then checks the claims against your brand facts and your own pages. Nothing runs until you confirm the cost.',
  },
  site_audit: {
    title: 'Audit crawler access',
    description: (max, domain) =>
      `Cansee fetches robots.txt, llms.txt and up to ${max} pages of ${domain} without running JavaScript, plus the home pages of the competitors you track. It fetches as CanseeAgent and never pretends to be another crawler. Nothing is billed.`,
  },
  prompt_research: {
    title: 'Find prompt ideas',
    description:
      "Cansee can suggest questions from your brand context and read Google's questions and related searches for your prompts. Nothing runs until you confirm the cost.",
  },
  fanout_google: {
    title: 'Check searches on Google',
    description:
      'Cansee searches Google for each search the engines ran and records where you appear on page one. Nothing runs until you confirm the cost.',
  },
  shopping_check: {
    title: 'Run a shopping check',
    description:
      'Cansee looks up each shopping question in Google Shopping and asks the AI engines you choose. Nothing runs until you confirm the cost.',
  },
}

/* ── Open state and params, kept in the runner ── */

const isOpen = computed(() => Boolean(r.value?.isOpen.value))
const current = computed(() => r.value?.params.value || {})
const options = computed(() => r.value?.options.value || null)
const estimate = computed(() => r.value?.estimate.value || null)
const choices = computed(() => options.value?.choices || {})
const limits = computed(() => options.value?.limits || {})

watch(
  () => props.open,
  (value) => {
    if (!r.value || value === undefined) return
    if (value && !r.value.isOpen.value) r.value.open(props.params || {})
    else if (!value && r.value.isOpen.value) r.value.close()
  },
  { immediate: true },
)

watch(isOpen, (value, before) => {
  if (value !== before) emit('update:open', value)
})

// The page changed its selection while the dialog is open.
watch(
  () => JSON.stringify(props.params ?? null),
  () => {
    if (r.value?.isOpen.value && props.params) r.value.setParams(props.params)
  },
)

function onOpenChange(value) {
  if (!r.value) return
  if (value) r.value.open(props.params || {})
  else r.value.close()
}

function update(patch) {
  r.value?.update(patch)
}

/* ── Words ── */

function plural(n, one, many) {
  const count = Number(n) || 0
  return `${integer.format(count)} ${count === 1 ? one : many}`
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const domain = computed(() => {
  if (props.extra?.domain) return props.extra.domain
  if (choices.value.domain) return choices.value.domain
  const planned = choices.value.evidence?.pages_planned?.[0]
  if (planned && hostOf(planned)) return hostOf(planned)
  // The page's project is the active one (the router makes the URL's project active).
  return hostOf(app.activeWebsite?.url || '') || 'your site'
})

const title = computed(() => COPY[props.kind]?.title || 'Run')
const description = computed(() => {
  const d = COPY[props.kind]?.description
  if (typeof d === 'function') return d(integer.format(limits.value.max_units || 20), domain.value)
  return d || ''
})

const serp = computed(() => options.value?.configured?.google_provider === 'serpapi')

// Free accounts never see dollars: AI work draws on the free AI
// allowance, engine answers on the free prompt runs.
const hideUsd = useHideUsd(() => estimate.value)

function leftPart(e) {
  if (!e?.allowance || e.allowance.unlimited) return ''
  return ` (${money(e.allowance.left_usd)} left this month)`
}

/** "up to $0.04 of your AI allowance ($2.10 left this month)", or the free words. */
function aiPart(ai, e, { left = true } = {}) {
  if (hideUsd.value) return "from this month's free AI allowance"
  return `up to ${money(ai.usd_max)} of your AI allowance${left ? leftPart(e) : ''}`
}

function googleCost(g) {
  if (serp.value) return hideUsd.value ? '' : `up to ${money(g.usd_max)}`
  return `about ${integer.format(Number(g.credits_max) || 0)} ScraperAPI credits`
}

// One line per part of the run; a line whose part is zero is left out.
const lines = computed(() => {
  const e = estimate.value
  if (!e) return []
  const ai = e.ai || {}
  const g = e.google || {}
  const out = []
  switch (props.kind) {
    case 'answer_analysis': {
      const answers = Number(e.units?.answers) || 0
      const days = PERIOD_DAYS[current.value.period || '30d'] || 30
      if (answers) {
        out.push(`${answers === 1 ? '1 answer that names you' : `${integer.format(answers)} answers that name you`}, last ${days} days.`)
      }
      if (Number(ai.calls_max)) {
        out.push(`AI: up to ${plural(ai.calls_max, 'request', 'requests')}, ${aiPart(ai, e)}.`)
      }
      const facts = Number(choices.value.evidence?.facts) || 0
      const pages = Number(e.fetches?.pages_max) || 0
      if (facts || pages) {
        out.push(`Evidence: ${plural(facts, 'brand fact', 'brand facts')} and up to ${plural(pages, 'page', 'pages')} of ${domain.value}. Reading pages is free.`)
      }
      break
    }
    case 'site_audit': {
      const pages = Number(e.units?.pages ?? choices.value.pages_planned) || 0
      const tracked = (choices.value.competitors || []).length
      const competitors = current.value.competitors === false ? 0 : Number(e.units?.competitors ?? tracked) || 0
      out.push(`${plural(pages, 'page', 'pages')} of ${domain.value} and ${plural(competitors, 'competitor home page', 'competitor home pages')}.`)
      break
    }
    case 'prompt_research': {
      if (Number(ai.calls_max)) out.push(`AI suggestions: ${aiPart(ai, e, { left: false })}.`)
      if (Number(g.pages_max)) {
        const cost = googleCost(g)
        out.push(`Google: ${plural(g.pages_max, 'results page', 'results pages')}${cost ? `, ${cost}` : ''}.`)
      }
      break
    }
    case 'fanout_google': {
      if (Number(g.pages_max)) {
        const cost = googleCost(g)
        out.push(`${plural(g.pages_max, 'search', 'searches')}, page one only${cost ? `: ${cost}` : ''}.`)
      }
      break
    }
    case 'shopping_check': {
      if (Number(g.pages_max)) {
        out.push(`Google Shopping: ${plural(g.pages_max, 'page', 'pages')}, about ${integer.format(Number(g.credits_max) || 0)} ScraperAPI credits.`)
      }
      const answers = Number(e.units?.answers ?? ai.calls_max) || 0
      if (answers) {
        const runs = hideUsd.value ? estimateRuns(e.prompt_runs) : null
        out.push(
          hideUsd.value
            ? `AI engines: ${plural(answers, 'answer', 'answers')}.${runs?.enough ? ` ${runs.text}` : ''}`
            : `AI engines: ${plural(answers, 'answer', 'answers')}, ${aiPart(ai, e)}.`,
        )
      }
      break
    }
  }
  if (GOOGLE_KINDS.has(props.kind) && typeof g.daily_left === 'number' && typeof g.daily_limit === 'number') {
    out.push(`${integer.format(g.daily_left)} of ${integer.format(g.daily_limit)} Google pages left today.`)
  }
  return out
})

const warnings = computed(() => estimate.value?.warnings || [])
const blockers = computed(() => estimate.value?.blockers || [])

const runLabel = computed(() => {
  if (props.kind === 'site_audit') return 'Run audit'
  const e = estimate.value
  if (!e) return 'Run'
  if (hideUsd.value) {
    const credits = serp.value ? 0 : Number(e.google?.credits_max || 0)
    return credits > 0 ? `Run for ${integer.format(credits)} credits` : 'Run'
  }
  const usd = Number(e.ai?.usd_max || 0) + (serp.value ? Number(e.google?.usd_max || 0) : 0)
  const credits = serp.value ? 0 : Number(e.google?.credits_max || 0)
  if (usd <= 0 && credits > 0) return `Run for ${integer.format(credits)} credits`
  const head = `Run for up to ${money(usd)}`
  return credits > 0 ? `${head} and ${integer.format(credits)} credits` : head
})

async function submit() {
  if (!r.value?.canStart.value) return
  const created = await r.value.start()
  if (created) emit('started', created)
}

/* ── Built-in controls ── */

// answer_analysis: engines null = all of them.
const engineChoices = computed(() => {
  if (props.kind === 'shopping_check') return props.extra?.engines || choices.value.engines || []
  return choices.value.engines || []
})
const selectedEngines = computed(() => {
  const chosen = current.value.engines
  if (chosen === null || chosen === undefined) {
    return props.kind === 'answer_analysis' ? engineChoices.value.map((e) => e.key) : []
  }
  return chosen
})

function toggleEngine(key, checked) {
  const set = new Set(selectedEngines.value)
  if (checked) set.add(key)
  else set.delete(key)
  const list = engineChoices.value.map((e) => e.key).filter((k) => set.has(k))
  const all = props.kind === 'answer_analysis' && list.length === engineChoices.value.length
  update({ engines: all ? null : list })
}

const promptChoices = computed(() => choices.value.prompts || [])
const googlePromptIds = computed(() => current.value.google_prompt_ids || [])
const googlePromptMax = computed(() => Number(limits.value.max_units) || 5)

function togglePrompt(id, checked) {
  const set = new Set(googlePromptIds.value.map(String))
  if (checked) set.add(String(id))
  else set.delete(String(id))
  update({ google_prompt_ids: promptChoices.value.map((p) => String(p.prompt_id)).filter((k) => set.has(k)) })
}

const productChoices = computed(() => props.extra?.products || [])
const productIds = computed(() => current.value.product_ids || [])
const productMax = computed(() => Number(limits.value.max_units) || 5)

function toggleProduct(id, checked) {
  const set = new Set(productIds.value.map(String))
  if (checked) set.add(String(id))
  else set.delete(String(id))
  update({ product_ids: productChoices.value.map((p) => String(p.id)).filter((k) => set.has(k)) })
}

const shoppingConfigured = computed(() => options.value?.configured?.shopping !== false)

function lastRead(p) {
  const ago = p.last_google_at ? timeAgo(p.last_google_at) : ''
  return ago ? `Last read ${ago}` : 'Never read'
}
</script>

<template>
  <DialogRoot v-if="r" :open="isOpen" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="ird-overlay" />
      <DialogContent class="ird" :aria-busy="r.estimating.value ? 'true' : 'false'">
        <div class="ird-head">
          <div>
            <DialogTitle class="ird-title">{{ title }}</DialogTitle>
            <DialogDescription class="ird-desc">{{ description }}</DialogDescription>
          </div>
          <DialogClose class="ird-close" aria-label="Close">
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <div class="ird-body">
          <slot name="controls" :params="current" :update="update" :options="options" :estimate="estimate">
            <!-- Answer analysis -->
            <template v-if="kind === 'answer_analysis'">
              <div class="ird-field">
                <PeriodSelect :model-value="current.period || '30d'" @update:model-value="update({ period: $event })" />
              </div>
              <fieldset v-if="engineChoices.length" class="ird-field">
                <legend class="ird-legend">AI engines</legend>
                <ul class="ird-checks">
                  <li v-for="e in engineChoices" :key="e.key">
                    <label class="ird-check">
                      <input
                        type="checkbox"
                        :checked="selectedEngines.includes(e.key)"
                        @change="toggleEngine(e.key, $event.target.checked)"
                      />
                      <span class="ird-check-text">{{ e.label }} · {{ integer.format(e.unanalyzed || 0) }} not analyzed</span>
                    </label>
                  </li>
                </ul>
              </fieldset>
              <label class="ird-check">
                <input
                  type="checkbox"
                  :checked="Boolean(current.reanalyze)"
                  @change="update({ reanalyze: $event.target.checked })"
                />
                <span class="ird-check-text">Analyze again answers already analyzed</span>
              </label>
            </template>

            <!-- Crawler audit -->
            <label v-else-if="kind === 'site_audit'" class="ird-check">
              <input
                type="checkbox"
                :checked="current.competitors !== false"
                @change="update({ competitors: $event.target.checked })"
              />
              <span class="ird-check-text">Include competitors</span>
            </label>

            <!-- Prompt research -->
            <template v-else-if="kind === 'prompt_research'">
              <label class="ird-check">
                <input
                  type="checkbox"
                  :checked="current.suggest !== false"
                  @change="update({ suggest: $event.target.checked })"
                />
                <span class="ird-check-text">Suggest prompts from my brand context</span>
              </label>
              <fieldset v-if="promptChoices.length" class="ird-field">
                <legend class="ird-legend">Read Google for these prompts</legend>
                <ul class="ird-checks">
                  <li v-for="p in promptChoices" :key="p.prompt_id">
                    <label class="ird-check">
                      <input
                        type="checkbox"
                        :checked="googlePromptIds.includes(String(p.prompt_id))"
                        :disabled="googlePromptIds.length >= googlePromptMax && !googlePromptIds.includes(String(p.prompt_id))"
                        @change="togglePrompt(p.prompt_id, $event.target.checked)"
                      />
                      <span class="ird-check-text">
                        {{ p.text }}
                        <span class="ird-check-sub">{{ lastRead(p) }}</span>
                      </span>
                    </label>
                  </li>
                </ul>
              </fieldset>
            </template>

            <!-- Shopping check -->
            <template v-else-if="kind === 'shopping_check'">
              <fieldset v-if="productChoices.length" class="ird-field">
                <legend class="ird-legend">Products</legend>
                <ul class="ird-checks">
                  <li v-for="p in productChoices" :key="p.id">
                    <label class="ird-check">
                      <input
                        type="checkbox"
                        :checked="productIds.includes(String(p.id))"
                        :disabled="productIds.length >= productMax && !productIds.includes(String(p.id))"
                        @change="toggleProduct(p.id, $event.target.checked)"
                      />
                      <span class="ird-check-text">{{ p.name }}</span>
                    </label>
                  </li>
                </ul>
              </fieldset>
              <fieldset v-if="engineChoices.length" class="ird-field">
                <legend class="ird-legend">AI engines</legend>
                <ul class="ird-checks">
                  <li v-for="e in engineChoices" :key="e.key">
                    <label class="ird-check" :class="{ 'is-off': e.configured === false }">
                      <input
                        type="checkbox"
                        :checked="selectedEngines.includes(e.key)"
                        :disabled="e.configured === false"
                        @change="toggleEngine(e.key, $event.target.checked)"
                      />
                      <span class="ird-check-text">
                        {{ e.label }}
                        <span v-if="e.configured === false" class="ird-check-sub">Not configured</span>
                      </span>
                    </label>
                  </li>
                </ul>
              </fieldset>
              <label class="ird-check" :class="{ 'is-off': !shoppingConfigured }">
                <input
                  type="checkbox"
                  :checked="Boolean(current.google_shopping) && shoppingConfigured"
                  :disabled="!shoppingConfigured"
                  @change="update({ google_shopping: $event.target.checked })"
                />
                <span class="ird-check-text">Check Google Shopping</span>
              </label>
            </template>
          </slot>

          <!-- Estimate -->
          <section
            class="ird-estimate"
            :class="{ 'is-stale': r.estimating.value }"
            aria-live="polite"
            aria-label="Estimated cost"
          >
            <p v-if="!estimate && r.error.value" class="ird-blocker">
              <CircleAlert class="ird-icon" aria-hidden="true" />
              <span>{{ r.error.value }}</span>
            </p>
            <p v-else-if="!estimate" class="ird-muted">Estimating the cost...</p>
            <template v-else>
              <p v-for="line in lines" :key="line" class="ird-line">{{ line }}</p>
              <p v-for="w in warnings" :key="w.code" class="ird-warning">
                <Info class="ird-icon" aria-hidden="true" />
                <span>{{ w.message }}</span>
              </p>
              <p v-for="b in blockers" :key="b.code" class="ird-blocker">
                <CircleAlert class="ird-icon" aria-hidden="true" />
                <span>{{ b.message }}</span>
              </p>
            </template>
          </section>

          <p v-if="r.changedNote.value" class="ird-note" role="status">{{ r.changedNote.value }}</p>
          <p v-if="estimate && r.error.value" class="ird-blocker" role="alert">
            <CircleAlert class="ird-icon" aria-hidden="true" />
            <span>{{ r.error.value }}</span>
          </p>
        </div>

        <div class="ird-foot">
          <Button variant="outline" class="rounded-full" @click="onOpenChange(false)">Cancel</Button>
          <Button class="rounded-full" :disabled="!r.canStart.value" @click="submit">
            {{ r.submitting.value ? 'Starting...' : runLabel }}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ird-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.ird {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(600px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
  outline: none;
}

.ird-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 0;
}

.ird-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ird-desc {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.ird-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.ird-close:hover {
  background: var(--accent);
  color: var(--foreground);
}

.ird-body {
  display: grid;
  gap: 16px;
  min-height: 0;
  padding: 18px 24px;
  overflow-y: auto;
}

.ird-field {
  display: grid;
  gap: 8px;
  min-width: 0;
  border: 0;
}

.ird-legend {
  margin-bottom: 6px;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 600;
}

.ird-checks {
  display: grid;
  gap: 2px;
  list-style: none;
}

.ird-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 4px;
  border-radius: 8px;
  color: var(--foreground);
  font-size: 13.5px;
  cursor: pointer;
}

.ird-check input {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--primary);
}

.ird-check.is-off {
  cursor: not-allowed;
}

.ird-check.is-off .ird-check-text {
  color: var(--muted-foreground);
}

.ird-check-text {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.ird-check-sub {
  color: var(--muted-foreground);
  font-size: 12px;
}

.ird-estimate {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--muted);
  font-size: 13.5px;
  line-height: 1.5;
  transition: opacity 0.15s ease;
}

.ird-estimate.is-stale {
  opacity: 0.55;
}

.ird-line {
  color: var(--foreground);
}

.ird-muted {
  color: var(--muted-foreground);
}

.ird-warning,
.ird-blocker {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
}

.ird-warning {
  color: var(--muted-foreground);
}

.ird-blocker {
  color: var(--destructive);
}

.ird-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.ird-note {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
}

.ird-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px 20px;
  border-top: 1px solid var(--border);
}

/* Phones: a full-height sheet. */
@media (max-width: 767px) {
  .ird {
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
    transform: none;
  }
  .ird-head,
  .ird-body,
  .ird-foot {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ird-body {
    flex: 1;
  }
  .ird-foot {
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}
</style>
