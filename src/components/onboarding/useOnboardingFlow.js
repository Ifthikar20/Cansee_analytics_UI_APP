// Shared state + logic for the first-run onboarding flow.
//
// The flow shell (OnboardingFlow.vue) calls provideOnboardingFlow();
// each step component pulls the same object via useOnboardingFlow().
// provide/inject (rather than props) because steps deep-mutate `form`
// (checkbox toggles, chip removal) and prop mutation is both a lint
// error and a lie about ownership.
//
// Five steps: website (with the homepage scan inline) -> brand ->
// competitors -> prompts -> first research. The scan drafts brand facts,
// competitors (from Google results and/or Claude) and up to 10 buyer
// questions (Google's own questions and searches and/or Claude) for the
// user to review; every row keeps where it came from. Nothing is saved
// until the last step. That step lists what was chosen, lets the user pick
// the AI engines of the first research (every configured one to start
// with) and says how many free prompt runs it uses. It then saves the
// project, writes the brand context the agents use (only into an empty
// one), and either hands the first research and its engines to the agent
// chat (useFirstResearch) or, skipped, tracks the chosen prompts the way
// Add prompts on the Overview does, asking only those engines.
import { computed, getCurrentScope, inject, onScopeDispose, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import api from '@/api/client'
import agentApi from '@/api/agent'
import websitesApi from '@/api/websites'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useFirstResearch } from '@/composables/agent/useFirstResearch'
import { saveDraft } from '@/lib/agent/storage'
import { NEW_CHAT_KEY } from '@/lib/agent/types'
import { countryLabel, DEFAULT_COUNTRY } from '@/lib/countries'
import { settingsVisible } from '@/lib/agent/setup'
import { hidesUsd, isRunsError, meteredRuns, runsErrorText, runsNeeded as runsNeededFor } from '@/lib/promptRuns'

const FlowKey = Symbol('onboarding-flow')

export const STEPS = Object.freeze([
  { id: 'website' },
  { id: 'brand' },
  { id: 'competitors' },
  { id: 'prompts' },
  { id: 'run' },
])

export const MAX_COMPETITORS = 5
// The Free plan tracks 5 prompts; the first research measures the same set.
export const MAX_PROMPTS = 5
// The scan suggests up to 10 questions; the first 3 start selected.
export const MAX_SUGGESTED_PROMPTS = 10
export const DEFAULT_PROMPTS = 3

// Where a drafted competitor or question came from (scan payload `source`
// and `topic_sources`): Google results, Claude, or both.
export const SOURCE = Object.freeze({ search: 'search', ai: 'ai', both: 'both' })
const SOURCES = Object.values(SOURCE)

// The sessionStorage entry the first page after setup reads.
export const FIRST_RUN_KEY = 'cs-onb-first-run'

// Field caps: the save endpoint's serializer (business_name 200, industry
// 100, description 600, each keyword 100), the brand context (offerings 20,
// each name 120) and the research prompt (3 to 300 characters).
export const LIMITS = Object.freeze({
  name: 200,
  industry: 100,
  description: 600,
  offering: 120,
  offerings: 20,
  audience: 600,
  voice: 300,
  competitorName: 120,
  competitorDomain: 253,
  promptMin: 3,
  prompt: 300,
  keyword: 100,
})

// How long the resolved scan stays on screen before the brand step.
export const SCAN_SETTLE_MS = 600

const COPY = Object.freeze({
  badUrl: 'Enter your website address, like yourcompany.com.',
  scanFailed: "We couldn't read this site.",
  tooManyScans: 'Too many scans in a row. Wait a minute and try again.',
  saveFailed: "We couldn't save your project. Please try again.",
  promptsNotTracked: "Your project is saved, but we couldn't add its starter prompts. Add them from Prompts on Analytics.",
  promptsNotChecked: 'Your project and prompts are saved, but the AI engines were not asked yet.',
})

const clip = (value, max) => String(value ?? '').trim().slice(0, max).trim()
const clipText = (value, max) => (typeof value === 'string' ? clip(value, max) : '')
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** https URL for what the user typed, or '' when it is not a web address. */
export function normalizeSiteUrl(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const { hostname } = new URL(withScheme)
    return hostname.includes('.') ? withScheme : ''
  } catch {
    return ''
  }
}

/** Host without "www." for display and the first message. */
export function siteHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return String(url || '')
  }
}

export function normalizeDomain(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .slice(0, LIMITS.competitorDomain)
}

function uniqueTexts(values, max) {
  const seen = new Set()
  const out = []
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue
    const text = clip(value.replace(/\s+/g, ' '), max)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const sourceOf = (value) => (SOURCES.includes(value) ? value : '')

/** A competitor's Google evidence {query, rank, url}, or null. */
function competitorEvidence(raw) {
  if (!raw || typeof raw !== 'object') return null
  const query = clipText(raw.query, LIMITS.prompt)
  if (!query) return null
  const rank = Number(raw.rank)
  return { query, rank: Number.isInteger(rank) && rank > 0 ? rank : null, url: webUrl(raw.url) }
}

/** A question's Google evidence {kind: 'question'|'related', text, query}, or null. */
function topicEvidence(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.kind !== 'question' && raw.kind !== 'related') return null
  return { kind: raw.kind, text: clipText(raw.text, LIMITS.prompt), query: clipText(raw.query, LIMITS.prompt) }
}

function uniqueCompetitors(values) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(values) ? values : []) {
    if (!raw || typeof raw !== 'object') continue
    const domain = normalizeDomain(raw.domain)
    const name = clip(raw.name || domain, LIMITS.competitorName)
    if (!name) continue
    const key = domain || name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const source = sourceOf(raw.source)
    // Evidence is a Google result; an AI suggestion has none.
    const evidence = source === SOURCE.ai ? null : competitorEvidence(raw.evidence)
    out.push({ name, domain, source, evidence })
  }
  return out
}

/** The scan's questions with their parallel sources and evidence, deduped, at most 10. */
function uniqueTopics(payload) {
  const topics = Array.isArray(payload?.topics) ? payload.topics : []
  const sources = Array.isArray(payload?.topic_sources) ? payload.topic_sources : []
  const evidence = Array.isArray(payload?.topic_evidence) ? payload.topic_evidence : []
  const seen = new Set()
  const out = []
  topics.forEach((value, i) => {
    if (typeof value !== 'string' || out.length >= MAX_SUGGESTED_PROMPTS) return
    const text = clip(value.replace(/\s+/g, ' '), LIMITS.prompt)
    const key = text.toLowerCase()
    if (text.length < LIMITS.promptMin || seen.has(key)) return
    seen.add(key)
    const source = sourceOf(sources[i])
    out.push({ text, source, evidence: source === SOURCE.ai ? null : topicEvidence(evidence[i]) })
  })
  return out
}

/** The scan's Google block, as far as the steps use it. */
function googleOf(raw) {
  const g = raw && typeof raw === 'object' ? raw : null
  if (!g) return null
  return {
    configured: g.configured === true,
    label: typeof g.label === 'string' ? g.label : '',
    error: typeof g.error === 'string' ? g.error : '',
  }
}

/** The address as given when it is an http(s) URL, else ''. */
export function webUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return ''
  try {
    return /^https?:$/.test(new URL(value).protocol) ? value : ''
  } catch {
    return ''
  }
}

function emptyScan() {
  // audience: whether the homepage itself said who the brand sells to.
  // google: the scan's Google lookup {configured, label, error}, or null
  // when the scan did not say (an older server, or Fill in by hand).
  return {
    products: 0,
    topics: 0,
    competitors: 0,
    audience: false,
    topics_source: '',
    competitors_source: '',
    missing_keys: [],
    google: null,
  }
}

// Why Google gave nothing usable, in words (scan google.error).
const GOOGLE_ERRORS = Object.freeze({
  daily_limit: "Google search reached today's limit for setup scans",
  limit_unavailable: "We couldn't check today's Google search limit",
  no_brand_results: 'Google showed results for a different name',
  empty_results: 'Google found no results for your brand',
})

function googleState(scan) {
  const g = scan?.google
  if (!g) return { known: false }
  if (!g.configured || g.error === 'serpapi_not_configured') return { known: true, ok: false, missing: true }
  if (g.error) return { known: true, ok: false, missing: false, reason: GOOGLE_ERRORS[g.error] || "Google search didn't answer this time" }
  return { known: true, ok: true }
}

const claudeMissing = (scan) => (scan?.missing_keys || []).includes('ANTHROPIC_API_KEY')

/** Where a competitor row came from, in words ('' when the scan did not say). */
export function competitorSourceText(c) {
  if (!c) return ''
  if (c.custom) return 'Added by you'
  const query = c.evidence?.query
  const google = query ? `Found on Google for "${query}"` : 'Found on Google'
  if (c.source === SOURCE.search) return google
  if (c.source === SOURCE.both) return `${google} and suggested by AI`
  if (c.source === SOURCE.ai) return 'Suggested by AI'
  return ''
}

/**
 * Where a suggested question came from: {badge, detail}. badge is short
 * ("From Google", "Suggested by AI"); detail names the Google search it came
 * from. Both '' for the user's own rows and rows the scan said nothing about.
 */
export function promptSource(p) {
  const none = { badge: '', detail: '' }
  if (!p || p.custom) return none
  const ev = p.evidence
  const where = ev?.kind === 'question' ? 'People also ask' : ev?.kind === 'related' ? 'Related search' : ''
  const detail = where ? (ev.query ? `${where} on Google for "${ev.query}"` : `${where} on Google`) : ''
  if (p.source === SOURCE.search) return { badge: 'From Google', detail }
  if (p.source === SOURCE.both) return { badge: 'From Google, worded by AI', detail }
  if (p.source === SOURCE.ai) return { badge: 'Suggested by AI', detail: '' }
  return none
}

/**
 * What step 3 says about where its competitors came from when Google or
 * Claude could not help: {text, settings} (settings: what to set, shown to
 * staff and DEBUG only), or null when both worked or the scan did not say.
 */
export function competitorNote(scan) {
  const g = googleState(scan)
  const noClaude = claudeMissing(scan)
  const found = Number(scan?.competitors) > 0
  const settings = []
  if (g.missing) settings.push('google')
  if (noClaude) settings.push('ANTHROPIC_API_KEY')
  const googleWhy = g.missing ? "Google search isn't set up on this workspace" : g.reason
  if (g.known && !g.ok) {
    if (found) return { text: `${googleWhy}, so these are AI suggestions, not Google results.`, settings }
    if (noClaude) return { text: `${googleWhy} and the AI service isn't set up, so we couldn't suggest competitors.`, settings }
    return { text: `${googleWhy}, and the AI service suggested none.`, settings }
  }
  if (noClaude) {
    return found
      ? { text: "The AI service isn't set up on this workspace, so these come straight from Google results, without an AI check.", settings }
      : { text: "The AI service isn't set up on this workspace, and Google results named no competitors.", settings }
  }
  return null
}

/**
 * What step 4 says about where its questions came from when Google or
 * Claude could not help: {text, settings}, or null. With no question at
 * all it says what to do instead.
 */
export function promptNote(scan) {
  const g = googleState(scan)
  const noClaude = claudeMissing(scan)
  const found = Number(scan?.topics) > 0
  const settings = []
  if (g.missing) settings.push('google')
  if (noClaude) settings.push('ANTHROPIC_API_KEY')
  const write = 'Write 1 to 5 questions your buyers ask.'
  if (!found) {
    if (scan?.topics_source === 'unavailable') {
      return { text: `Suggesting questions needs Google search or the AI service, and neither is set up here. ${write}`, settings }
    }
    return { text: `We couldn't suggest questions for your homepage. ${write}`, settings }
  }
  if (noClaude) return { text: "The AI service isn't set up on this workspace, so these are Google's own questions and searches.", settings }
  if (g.known && !g.ok) {
    const why = g.missing ? "Google search isn't set up on this workspace" : g.reason
    return { text: `${why}, so these are AI suggestions, not Google's questions.`, settings }
  }
  return null
}


function blankForm({ url = '', location = DEFAULT_COUNTRY } = {}) {
  return {
    url,
    business_name: '',
    industry: '',
    description: '',
    offerings: [],
    audience: '',
    voice: '',
    // The logo the scan found on the site, shown on the brand step only:
    // the save endpoint takes no logo.
    logo_url: '',
    competitors: [],
    prompts: [],
    location,
    // The AI engines the first research asks (public keys). Filled with
    // every configured engine once the agent's status is known.
    engines: [],
    scan: emptyScan(),
  }
}

/**
 * The first message of the first research (swarm_frontend.md 12f). The
 * prompts appear verbatim so the agent may track them.
 */
export function firstResearchText({ brand, host, prompts, location, competitors, engines }) {
  const lines = [`Research ${brand} (${host}) on Google and the AI engines for these prompts:`]
  ;(prompts || []).forEach((text, index) => lines.push(`${index + 1}. ${text}`))
  lines.push(location ? `Search from ${countryLabel(location)} (${location}).` : 'Search without a country (global).')
  const named = (competitors || []).map((c) => (c.domain ? `${c.name} (${c.domain})` : c.name))
  if (named.length) lines.push(`Competitors to compare: ${named.join(', ')}.`)
  // The engines chosen on the last step (labels); the request carries their keys too.
  if (Array.isArray(engines) && engines.length) lines.push(`Ask only these AI engines: ${engines.join(', ')}.`)
  return lines.join('\n')
}

function prefersReducedMotion() {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

export function provideOnboardingFlow({ onComplete } = {}) {
  const auth = useAuthStore()
  const app = useAppStore()
  const toast = useToast()
  const router = useRouter()
  const firstResearch = useFirstResearch()

  const step = ref(0)
  // 'forward' | 'back' — set BEFORE mutating `step` so the step
  // transition picks the right slide direction.
  const direction = ref('forward')
  const form = ref(blankForm())

  /* ── Step 1: website and scan ── */

  const urlInput = ref('')
  // 'idle' (the address field) | 'scanning' | 'resolved' (rows filled in)
  const scanState = ref('idle')
  const scanHost = ref('')
  // A typed address that is not a web address; the scan never ran.
  const urlError = ref('')
  // The scan ran and failed; the step offers Try again and Fill in by hand.
  const scanError = ref('')
  // The address the form was drafted from: the same address again keeps
  // the user's edits instead of scanning (and paying for) it twice.
  const scannedUrl = ref('')
  let scanToken = 0
  let advanceTimer = null

  /* ── Steps 2 to 4: inputs for the "add" rows ── */

  const newOffering = ref('')
  const newCompetitorName = ref('')
  const newCompetitorDomain = ref('')
  const newPrompt = ref('')

  /* ── Step 5: agent status and finishing ── */

  const agentStatus = ref(null)
  // 'idle' | 'loading' | 'ready' | 'error'
  const statusState = ref('idle')
  // '' | 'research' | 'skip': which finish is running.
  const finishing = ref('')
  const saving = computed(() => Boolean(finishing.value))

  const displayStep = computed(() => step.value + 1)
  const totalSteps = STEPS.length
  const host = computed(() => siteHost(form.value.url))

  const selectedCompetitors = computed(() => form.value.competitors.filter((c) => c.selected))
  const competitorCapReached = computed(() => selectedCompetitors.value.length >= MAX_COMPETITORS)
  const selectedPrompts = computed(() => form.value.prompts.filter((p) => p.selected))
  const promptCapReached = computed(() => selectedPrompts.value.length >= MAX_PROMPTS)

  // The website step moves on through the scan (or Fill in by hand), and
  // the last step through its finish buttons; next() serves the others.
  const canContinue = computed(() => {
    switch (STEPS[step.value]?.id) {
      case 'brand':
        return Boolean(form.value.business_name.trim())
      case 'competitors':
        return selectedCompetitors.value.length <= MAX_COMPETITORS
      case 'prompts':
        return selectedPrompts.value.length >= 1 && selectedPrompts.value.length <= MAX_PROMPTS
      default:
        return false
    }
  })

  const scanRows = computed(() => {
    const resolved = scanState.value === 'resolved'
    const s = form.value.scan
    const row = (key, label, n, found, missing) => ({
      key,
      label,
      state: resolved ? (n > 0 ? 'found' : 'missing') : 'pending',
      text: resolved ? (n > 0 ? found(n) : missing) : '',
    })
    // Where the rows came from, when the scan says.
    const prompts = (n) =>
      s.topics_source === SOURCE.search
        ? `${plural(n, 'question', 'questions')} found on Google`
        : s.topics_source === SOURCE.both
          ? `${plural(n, 'prompt', 'prompts')} from Google and AI`
          : `${plural(n, 'prompt', 'prompts')} drafted`
    const competitors = (n) =>
      s.competitors_source === SOURCE.search || s.competitors_source === SOURCE.both
        ? `${plural(n, 'competitor', 'competitors')} found on Google`
        : s.competitors_source === SOURCE.ai
          ? `${plural(n, 'competitor', 'competitors')} suggested by AI`
          : `${plural(n, 'competitor', 'competitors')} found`
    return [
      row('brand', 'Your brand and what you sell', s.products, (n) => `${plural(n, 'offering', 'offerings')} found`, 'Not found on your homepage'),
      row('prompts', 'Buyer prompts', s.topics, prompts, "Couldn't draft prompts"),
      row('competitors', 'Competitors', s.competitors, competitors, 'None found'),
    ]
  })

  /* ── Navigation ── */

  function goTo(index) {
    const target = Math.max(0, Math.min(STEPS.length - 1, index))
    if (target === step.value) return
    direction.value = target > step.value ? 'forward' : 'back'
    // Back on the website step shows the address field, not the old scan.
    if (target === 0) {
      clearAdvance()
      scanState.value = 'idle'
    }
    step.value = target
  }

  function next() {
    if (!canContinue.value) return false
    goTo(step.value + 1)
    return true
  }

  function back() {
    if (saving.value) return
    goTo(step.value - 1)
  }

  function clearAdvance() {
    if (advanceTimer) clearTimeout(advanceTimer)
    advanceTimer = null
  }

  /* ── Scan ── */

  function adoptScan(payload, url) {
    const offerings = uniqueTexts(payload.products, LIMITS.offering).slice(0, LIMITS.offerings)
    const prompts = uniqueTopics(payload)
    const competitors = uniqueCompetitors(payload.competitors)
    // Audience and voice come only from the page's own words; the scan
    // leaves them empty when the page does not say, and so does the form.
    const audience = clipText(payload.audience, LIMITS.audience)
    form.value = {
      ...blankForm({ url: typeof payload.url === 'string' && payload.url ? payload.url : url, location: form.value.location }),
      business_name: clip(payload.business_name, LIMITS.name),
      industry: clip(payload.industry, LIMITS.industry),
      description: clip(payload.description_short || payload.description_raw, LIMITS.description),
      offerings,
      audience,
      voice: clipText(payload.voice, LIMITS.voice),
      logo_url: webUrl(payload.logo_url),
      competitors: competitors.map((c, i) => ({ ...c, selected: i < MAX_COMPETITORS, custom: false })),
      prompts: prompts.map((p, i) => ({ ...p, selected: i < DEFAULT_PROMPTS, custom: false })),
      engines: form.value.engines,
      scan: {
        products: offerings.length,
        topics: prompts.length,
        competitors: competitors.length,
        audience: Boolean(audience),
        topics_source: typeof payload.topics_source === 'string' ? payload.topics_source : '',
        competitors_source: typeof payload.competitors_source === 'string' ? payload.competitors_source : '',
        missing_keys: Array.isArray(payload.missing_keys) ? payload.missing_keys.map(String) : [],
        google: googleOf(payload.google),
      },
    }
  }

  function scanFailure(err) {
    const status = err?.response?.status
    if (status === 429) return { scan: COPY.tooManyScans }
    const server = err?.response?.data?.error
    const message = typeof server === 'object' && typeof server?.message === 'string' ? server.message.trim() : ''
    // 400: the address itself was refused; scanning it again cannot help.
    if (status === 400) return { url: message || COPY.badUrl }
    if (err?.scanMessage) return { scan: err.scanMessage }
    return { scan: message && status && status < 500 ? message : COPY.scanFailed }
  }

  async function startScan() {
    if (scanState.value === 'scanning' || saving.value) return
    const url = normalizeSiteUrl(urlInput.value)
    urlError.value = ''
    scanError.value = ''
    if (!url) {
      urlError.value = COPY.badUrl
      return
    }
    if (scannedUrl.value && scannedUrl.value === url) {
      goTo(1)
      return
    }
    const token = ++scanToken
    scanHost.value = siteHost(url)
    scanState.value = 'scanning'
    try {
      // Silent: the step shows the failure inline. No 429 retry: the user
      // is told to wait instead of watching a silent retry.
      const { data: payload } = await api.post('/onboarding/scan/', { url }, { _silentError: true, _noRetry429: true })
      if (token !== scanToken) return
      if (!payload?.success) {
        const failed = new Error('scan failed')
        failed.scanMessage = typeof payload?.error === 'string' && payload.error.trim() ? payload.error.trim() : COPY.scanFailed
        throw failed
      }
      adoptScan(payload, url)
      scannedUrl.value = url
      scanState.value = 'resolved'
      clearAdvance()
      if (prefersReducedMotion()) {
        goTo(1)
      } else {
        advanceTimer = setTimeout(() => {
          advanceTimer = null
          if (step.value === 0 && scanState.value === 'resolved') goTo(1)
        }, SCAN_SETTLE_MS)
      }
    } catch (err) {
      if (token !== scanToken) return
      scanState.value = 'idle'
      const failure = scanFailure(err)
      urlError.value = failure.url || ''
      scanError.value = failure.scan || ''
    }
  }

  /** Skip the scan: the brand step with only the address filled in. */
  function fillByHand() {
    const url = normalizeSiteUrl(urlInput.value)
    if (!url) {
      scanError.value = ''
      urlError.value = COPY.badUrl
      return
    }
    scanToken += 1
    clearAdvance()
    form.value = { ...blankForm({ url, location: form.value.location }), engines: form.value.engines }
    scannedUrl.value = ''
    urlError.value = ''
    scanError.value = ''
    scanState.value = 'idle'
    goTo(1)
  }

  /* ── Brand ── */

  function addOffering() {
    const name = clip(newOffering.value.replace(/\s+/g, ' '), LIMITS.offering)
    if (!name) return false
    const list = form.value.offerings
    const exists = list.some((o) => o.toLowerCase() === name.toLowerCase())
    if (!exists && list.length >= LIMITS.offerings) return false
    if (!exists) list.push(name)
    newOffering.value = ''
    return !exists
  }

  function removeOffering(index) {
    if (index < 0 || index >= form.value.offerings.length) return
    form.value.offerings.splice(index, 1)
  }

  /* ── Competitors ── */

  function setCompetitorSelected(index, on) {
    const row = form.value.competitors[index]
    if (!row) return false
    if (on && !row.selected && competitorCapReached.value) return false
    row.selected = Boolean(on)
    return true
  }

  function addCompetitor() {
    const name = clip(newCompetitorName.value.replace(/\s+/g, ' '), LIMITS.competitorName)
    if (!name) return false
    const domain = normalizeDomain(newCompetitorDomain.value)
    // Dedupe against existing rows by domain (preferred) or name (fallback).
    const exists = form.value.competitors.some((c) => {
      if (domain && c.domain) return c.domain === domain
      return c.name.toLowerCase() === name.toLowerCase()
    })
    newCompetitorName.value = ''
    newCompetitorDomain.value = ''
    if (exists) return false
    form.value.competitors.push({ name, domain, source: '', evidence: null, selected: !competitorCapReached.value, custom: true })
    return true
  }

  function removeCompetitor(index) {
    const row = form.value.competitors[index]
    if (!row || !row.custom) return
    form.value.competitors.splice(index, 1)
  }

  /* ── Prompts ── */

  function setPromptSelected(index, on) {
    const row = form.value.prompts[index]
    if (!row) return false
    if (on && !row.selected && promptCapReached.value) return false
    row.selected = Boolean(on)
    return true
  }

  function addPrompt() {
    const text = clip(newPrompt.value.replace(/\s+/g, ' '), LIMITS.prompt)
    if (text.length < LIMITS.promptMin) return false
    const existing = form.value.prompts.find((p) => p.text.toLowerCase() === text.toLowerCase())
    newPrompt.value = ''
    if (existing) {
      if (!existing.selected && !promptCapReached.value) existing.selected = true
      return false
    }
    form.value.prompts.push({ text, source: '', evidence: null, selected: !promptCapReached.value, custom: true })
    return true
  }

  function removePrompt(index) {
    const row = form.value.prompts[index]
    if (!row || !row.custom) return
    form.value.prompts.splice(index, 1)
  }

  /* ── Steps 3 to 5: the agent's status ── */

  // A status answer for a flow that has since been left (or a second load
  // that overtook it) is dropped.
  let statusToken = 0
  // Whether the user changed the engine choice; until then a fresh status
  // selects every configured engine.
  let enginesTouched = false

  async function loadAgentStatus() {
    if (statusState.value === 'loading') return
    const token = ++statusToken
    statusState.value = 'loading'
    try {
      const { data } = await agentApi.status({ _silentError: true })
      if (token !== statusToken) return
      agentStatus.value = data && typeof data === 'object' ? data : null
      statusState.value = agentStatus.value ? 'ready' : 'error'
      adoptEngines()
    } catch {
      if (token !== statusToken) return
      agentStatus.value = null
      statusState.value = 'error'
    }
  }

  // Staff, DEBUG and local builds also see the setting to change.
  const showSettings = computed(() => settingsVisible(agentStatus.value))

  /** The words for a note's settings list ('google' is the Google keys). */
  function settingNames(list) {
    if (!showSettings.value || !Array.isArray(list)) return ''
    const google = agentStatus.value?.google?.key_settings
    const names = list.flatMap((name) =>
      name === 'google' ? [Array.isArray(google) && google.length ? google.join(' or ') : 'SERPAPI_KEY or SCRAPERAPI_KEY'] : [name],
    )
    return names.length ? `Setting to add: ${names.join('; ')}.` : ''
  }

  /**
   * The AI engines from GET agent/status/: [{key, label, configured,
   * setting}], with setting ('' unless the viewer may see it) naming the key
   * an unconfigured engine needs. [] until the status is known.
   */
  const engineRows = computed(() => {
    const list = Array.isArray(agentStatus.value?.engines) ? agentStatus.value.engines : []
    const seen = new Set()
    const out = []
    for (const e of list) {
      const key = typeof e?.key === 'string' ? e.key : ''
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({
        key,
        label: String(e.label || key).trim(),
        configured: e.configured === true,
        setting: showSettings.value && typeof e.key_setting === 'string' ? e.key_setting : '',
      })
    }
    return out
  })
  const configuredEngines = computed(() => engineRows.value.filter((e) => e.configured))
  // The chosen engines that can answer, in display order.
  const chosenEngines = computed(() => configuredEngines.value.filter((e) => form.value.engines.includes(e.key)))

  function adoptEngines() {
    const keys = configuredEngines.value.map((e) => e.key)
    form.value.engines = enginesTouched ? form.value.engines.filter((k) => keys.includes(k)) : keys
  }

  /** Tick or untick an engine of the first research; an unconfigured one cannot be picked. */
  function setEngineSelected(key, on) {
    const row = engineRows.value.find((e) => e.key === key)
    if (!row || (on && !row.configured)) return false
    enginesTouched = true
    const rest = form.value.engines.filter((k) => k !== key)
    form.value.engines = on ? [...rest, key] : rest
    return true
  }

  // The account's free prompt runs, or null for paid (unlimited) accounts
  // and when the status did not say.
  const promptRuns = computed(() => meteredRuns(agentStatus.value?.prompt_runs))
  // Free accounts see prompt runs, never dollars.
  const hideUsd = computed(() => hidesUsd(agentStatus.value))
  // One run is one prompt answered by one engine.
  const runsNeeded = computed(() => selectedPrompts.value.length * chosenEngines.value.length)
  // {enough, text} for free accounts, null otherwise.
  const runsCheck = computed(() => runsNeededFor(runsNeeded.value, promptRuns.value))

  // 'checking' | 'available' | 'unavailable' | 'allowance' | 'no_engines' | 'unknown'
  const availability = computed(() => {
    if (statusState.value === 'idle' || statusState.value === 'loading') return 'checking'
    const s = agentStatus.value
    if (!s) return 'unknown'
    if (s.enabled !== true || s.configured === false || s.live_available === false || s.swarm?.enabled === false) {
      return 'unavailable'
    }
    const reason = s.research && typeof s.research === 'object' ? s.research.reason : null
    if (['agent_disabled', 'agent_not_configured', 'agent_unavailable', 'research_disabled'].includes(reason)) {
      return 'unavailable'
    }
    if (s.allowance?.exceeded || reason === 'allowance_exceeded') return 'allowance'
    // The first research needs at least one AI engine to ask.
    if (Array.isArray(s.engines) && !configuredEngines.value.length) return 'no_engines'
    return 'available'
  })

  // Why Start research is off while the agent itself is there: '' |
  // 'no_engine' (none ticked) | 'runs' (more runs than are left).
  const researchBlock = computed(() => {
    if (availability.value !== 'available') return ''
    if (engineRows.value.length && !chosenEngines.value.length) return 'no_engine'
    if (runsCheck.value && !runsCheck.value.enough) return 'runs'
    return ''
  })

  watch(step, (index) => {
    // Steps 3 and 4 use the status to show staff the setting names; the
    // last step needs it to start research.
    if (STEPS[index]?.id === 'run') {
      if (statusState.value !== 'ready') loadAgentStatus()
    } else if (index >= 2 && statusState.value === 'idle') {
      loadAgentStatus()
    }
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      statusToken += 1
    })
  }

  /* ── Finish ── */

  const firstMessage = computed(() =>
    firstResearchText({
      brand: form.value.business_name.trim(),
      host: host.value,
      prompts: selectedPrompts.value.map((p) => p.text),
      location: form.value.location,
      competitors: selectedCompetitors.value,
      engines: chosenEngines.value.map((e) => e.label),
    }),
  )

  // The engine keys the first research or scan is limited to; null when the
  // status was never read (the server then asks every configured engine).
  const engineChoice = () => (engineRows.value.length ? chosenEngines.value.map((e) => e.key) : null)

  /**
   * The brand context the agents use, as context entries (p2_contract.md
   * 11d mapping): an Audience entry, an Execution entry titled Voice and one
   * Offerings entry per offering. Written only into a project whose context
   * has no entry and no suggestion yet.
   */
  async function saveBrandContext(websiteId) {
    const audience = form.value.audience.trim()
    const voice = form.value.voice.trim()
    const offerings = form.value.offerings.map((name) => String(name || '').trim()).filter(Boolean)
    if (!audience && !voice && !offerings.length) return
    try {
      const { data } = await agentApi.getContext(websiteId, { _silentError: true })
      // A context someone already started (a project set up before) is never added to.
      const totals = data?.totals
      if (!totals || Number(totals.entries) !== 0 || Number(totals.suggested) !== 0) return
      const entries = []
      if (audience) entries.push({ section: 'audience', title: 'Audience', body: audience })
      if (voice) entries.push({ section: 'execution', title: 'Voice', body: voice })
      for (const name of offerings) entries.push({ section: 'offerings', title: name, body: '' })
      for (const entry of entries) await agentApi.createContextEntry(websiteId, { ...entry, references: [] })
    } catch {
      // The Context page can still be filled in later; it never blocks setup.
    }
  }

  async function finish(mode) {
    if (finishing.value) return
    finishing.value = mode
    const research = mode === 'research'
    const prompts = selectedPrompts.value.map((p) => p.text)
    const competitors = selectedCompetitors.value.map((c) => ({ name: c.name, domain: c.domain }))
    const text = firstMessage.value
    const engines = engineChoice()
    let websiteId
    try {
      // Silent: the one toast below reports the failure.
      const { data: saved } = await api.post(
        '/onboarding/save/',
        {
          url: form.value.url,
          business_name: form.value.business_name.trim(),
          industry: form.value.industry.trim(),
          description: form.value.description.trim(),
          // The project's topics; the endpoint takes at most 100 characters each.
          keywords: prompts.map((p) => clip(p, LIMITS.keyword)),
          competitors,
        },
        { _silentError: true },
      )
      websiteId = saved?.website_id ? String(saved.website_id) : ''
      if (!websiteId) throw new Error('The project was not created.')
    } catch (err) {
      toast.error(err?.displayMessage || COPY.saveFailed)
      finishing.value = ''
      return
    }

    if (agentStatus.value?.enabled !== false) await saveBrandContext(websiteId)

    // The agent routes resolve :websiteId against this list.
    try {
      const { data } = await websitesApi.list({ _silentError: true })
      if (Array.isArray(data)) app.setWebsites(data)
    } catch {}

    // Where the agent chat finds the first research: the stash, or, when
    // session storage refuses it, the new chat's composer with the research
    // agent picked (the user then presses Send).
    let handedOff = false
    let auditId = null
    if (research) {
      handedOff = firstResearch.stash({ websiteId, text, engines })
      const uid = auth.user?.id
      if (!handedOff && uid !== undefined && uid !== null) saveDraft(String(uid), websiteId, NEW_CHAT_KEY, text)
    } else {
      // The chosen prompts become tracked prompts, the same way Add prompts
      // on the Overview adds them (which also starts their first AI engine
      // check, limited to the chosen engines). With no engine chosen
      // nothing is asked now. The project is already saved, so a failure
      // here only asks the user to add them again.
      const body = { text: prompts.join('\n'), location: form.value.location }
      if (engines && engines.length) body.engines = engines
      else if (engines) body.scan = false
      try {
        const { data } = await api.post(`/prompt-library/websites/${encodeURIComponent(websiteId)}/prompts/`, body, {
          _silentError: true,
        })
        auditId = typeof data?.scan_audit_id === 'string' && data.scan_audit_id ? data.scan_audit_id : null
        const scanError = data?.scan_error
        if (scanError && isRunsError(scanError.error)) {
          toast.warning(`${COPY.promptsNotChecked} ${runsErrorText(scanError.error, scanError)}`)
        }
      } catch {
        toast.warning(COPY.promptsNotTracked)
      }
    }

    // The first page after setup shows how this first run is going.
    try {
      sessionStorage.setItem(
        FIRST_RUN_KEY,
        JSON.stringify({ websiteId, chatId: null, mode: research ? 'research' : 'skip', auditId, engines, createdAt: Date.now() }),
      )
    } catch {
      // storage full/blocked: that page simply does not show
    }

    // Hand the paywall its personalization line ("{domain} is set up with
    // N competitors"): the session payload carries no domains, and
    // /paywall renders outside the app store's website loading.
    try {
      sessionStorage.setItem(
        'cs-onb-summary',
        JSON.stringify({ domain: host.value, competitors: competitors.length, topics: prompts.length, ts: Date.now() }),
      )
    } catch {
      // storage full/blocked: the paywall falls back
    }

    await auth.fetchSession()
    // Route from HERE, not from the parent: the session refresh above
    // flips needs_onboarding, which unmounts the whole flow while this
    // function is still running. router.push is app-level and survives
    // the unmount. A paywalled user meets the research after paying (the
    // agent page finds it waiting and offers it).
    if (auth.session?.next_route === 'paywall') {
      router.push('/paywall')
    } else if (research) {
      router.push({
        name: 'agent-home',
        params: { websiteId },
        query: handedOff ? { start: 'first-research' } : { agent: 'gap_analyst' },
      })
    }
    onComplete?.()
    finishing.value = ''
  }

  function startResearch() {
    return finish('research')
  }

  function skipResearch() {
    return finish('skip')
  }

  if (getCurrentScope()) onScopeDispose(clearAdvance)

  const flow = {
    steps: STEPS,
    totalSteps,
    step,
    direction,
    displayStep,
    form,
    host,
    canContinue,
    next,
    back,
    goTo,
    // website
    urlInput,
    scanState,
    scanHost,
    scanRows,
    urlError,
    scanError,
    startScan,
    fillByHand,
    // brand
    newOffering,
    addOffering,
    removeOffering,
    // competitors
    newCompetitorName,
    newCompetitorDomain,
    selectedCompetitors,
    competitorCapReached,
    setCompetitorSelected,
    addCompetitor,
    removeCompetitor,
    showSettings,
    settingNames,
    // prompts
    newPrompt,
    selectedPrompts,
    promptCapReached,
    setPromptSelected,
    addPrompt,
    removePrompt,
    // first research
    agentStatus,
    statusState,
    availability,
    engineRows,
    configuredEngines,
    chosenEngines,
    setEngineSelected,
    promptRuns,
    hideUsd,
    runsNeeded,
    runsCheck,
    researchBlock,
    loadAgentStatus,
    firstMessage,
    finishing,
    saving,
    startResearch,
    skipResearch,
  }
  provide(FlowKey, flow)
  return flow
}

export function useOnboardingFlow() {
  const flow = inject(FlowKey, null)
  if (!flow) {
    throw new Error('useOnboardingFlow() called outside an OnboardingFlow tree')
  }
  return flow
}
