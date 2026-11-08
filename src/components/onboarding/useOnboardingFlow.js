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
// competitors and buyer prompts for the user to review; nothing is saved
// until the last step. That step saves the project, writes the brand
// context the agents use (only into an empty one), and then either hands
// the first research to the agent chat (useFirstResearch) or, skipped,
// tracks the chosen prompts the way Add prompts on the Overview does.
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
import { noteSetupFinished } from '@/lib/setup/storage'
import { NEW_CHAT_KEY } from '@/lib/agent/types'
import { countryLabel, DEFAULT_COUNTRY } from '@/lib/countries'

const FlowKey = Symbol('onboarding-flow')

export const STEPS = Object.freeze([
  { id: 'website' },
  { id: 'brand' },
  { id: 'competitors' },
  { id: 'prompts' },
  { id: 'run' },
])

export const MAX_COMPETITORS = 5
export const MAX_PROMPTS = 5
const DEFAULT_PROMPTS = 3

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
    out.push({ name, domain })
  }
  return out
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
  return { products: 0, topics: 0, competitors: 0, audience: false, topics_source: '', missing_keys: [] }
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
    scan: emptyScan(),
  }
}

/**
 * The first message of the first research (swarm_frontend.md 12f). The
 * prompts appear verbatim so the agent may track them.
 */
export function firstResearchText({ brand, host, prompts, location, competitors }) {
  const lines = [`Research ${brand} (${host}) on Google and the AI engines for these prompts:`]
  ;(prompts || []).forEach((text, index) => lines.push(`${index + 1}. ${text}`))
  lines.push(location ? `Search from ${countryLabel(location)} (${location}).` : 'Search without a country (global).')
  const named = (competitors || []).map((c) => (c.domain ? `${c.name} (${c.domain})` : c.name))
  if (named.length) lines.push(`Competitors to compare: ${named.join(', ')}.`)
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
    return [
      row('brand', 'Your brand and what you sell', s.products, (n) => `${plural(n, 'offering', 'offerings')} found`, 'Not found on your homepage'),
      row('prompts', 'Buyer prompts', s.topics, (n) => `${plural(n, 'prompt', 'prompts')} drafted`, "Couldn't draft prompts"),
      row('competitors', 'Competitors', s.competitors, (n) => `${plural(n, 'competitor', 'competitors')} found`, 'None found'),
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
    const prompts = uniqueTexts(payload.topics, LIMITS.prompt).filter((t) => t.length >= LIMITS.promptMin)
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
      prompts: prompts.map((text, i) => ({ text, selected: i < DEFAULT_PROMPTS, custom: false })),
      scan: {
        products: offerings.length,
        topics: prompts.length,
        competitors: competitors.length,
        audience: Boolean(audience),
        topics_source: typeof payload.topics_source === 'string' ? payload.topics_source : '',
        missing_keys: Array.isArray(payload.missing_keys) ? payload.missing_keys.map(String) : [],
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
    form.value = blankForm({ url, location: form.value.location })
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
    form.value.competitors.push({ name, domain, selected: !competitorCapReached.value, custom: true })
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
    form.value.prompts.push({ text, selected: !promptCapReached.value, custom: true })
    return true
  }

  function removePrompt(index) {
    const row = form.value.prompts[index]
    if (!row || !row.custom) return
    form.value.prompts.splice(index, 1)
  }

  /* ── Step 5: the agent's status ── */

  async function loadAgentStatus() {
    if (statusState.value === 'loading') return
    statusState.value = 'loading'
    try {
      const { data } = await agentApi.status({ _silentError: true })
      agentStatus.value = data && typeof data === 'object' ? data : null
      statusState.value = agentStatus.value ? 'ready' : 'error'
    } catch {
      agentStatus.value = null
      statusState.value = 'error'
    }
  }

  // 'checking' | 'available' | 'unavailable' | 'allowance' | 'unknown'
  const availability = computed(() => {
    if (statusState.value === 'idle' || statusState.value === 'loading') return 'checking'
    const s = agentStatus.value
    if (!s) return 'unknown'
    if (s.enabled !== true || s.configured === false || s.live_available === false || s.swarm?.enabled === false) {
      return 'unavailable'
    }
    if (s.allowance?.exceeded) return 'allowance'
    return 'available'
  })

  watch(
    step,
    (index) => {
      if (STEPS[index]?.id === 'run' && statusState.value !== 'ready') loadAgentStatus()
    },
  )

  /* ── Finish ── */

  const firstMessage = computed(() =>
    firstResearchText({
      brand: form.value.business_name.trim(),
      host: host.value,
      prompts: selectedPrompts.value.map((p) => p.text),
      location: form.value.location,
      competitors: selectedCompetitors.value,
    }),
  )

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

    // The analytics board's Setup panel greets this project's first landings.
    noteSetupFinished(auth.user?.id, websiteId, research ? 'research' : 'skip')

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
    if (research) {
      handedOff = firstResearch.stash({ websiteId, text })
      const uid = auth.user?.id
      if (!handedOff && uid !== undefined && uid !== null) saveDraft(String(uid), websiteId, NEW_CHAT_KEY, text)
    } else {
      // The chosen prompts become tracked prompts, the same way Add prompts
      // on the Overview adds them (which also starts their first AI engine
      // check). The project is already saved, so a failure here only asks
      // the user to add them again.
      try {
        await api.post(
          `/prompt-library/websites/${encodeURIComponent(websiteId)}/prompts/`,
          { text: prompts.join('\n'), location: form.value.location },
          { _silentError: true },
        )
      } catch {
        toast.warning(COPY.promptsNotTracked)
      }
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
