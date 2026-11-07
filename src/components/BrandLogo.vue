<script setup>
import { ref, watch } from 'vue'
import promptLibrary from '@/api/promptLibrary'
import { brandColor, brandInitial, brandDomainGuess } from '@/lib/brandLogo'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
  // Domain matched to this brand from cited sources. When present we ask
  // the backend logo crawler for the site's real logo.
  domain: { type: String, default: '' },
  // A logo URL already found for this brand (the onboarding scan's),
  // tried before the domain crawl.
  src: { type: String, default: '' },
  // Whether to guess by name (steps 2 and 3 below) when the domain gives
  // no logo. Off where another company's logo would mislead, such as the
  // user's own brand during onboarding.
  guess: { type: Boolean, default: true },
})

// Logo resolution order:
//   0. the given src, when there is one
//   1. crawl the brand's domain (backend /logo/) for the real site logo
//   2. Clearbit autocomplete by name (known companies)
//   3. Google favicon for a guessed domain (squashed brand name + .com)
//   4. deterministic colored initial badge
// Every resolved URL is cached in-memory + localStorage so each
// domain/name hits the network at most once. A URL that failed to load is
// never shown again in the same resolution, so a crawl that returns the
// same broken URL moves on instead of leaving a broken image.

const MEM = new Map()
const LS_KEY = 'brandLogoCache.v2'
function loadLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveLS(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch { /* ignore quota */ }
}
function cacheGet(key) {
  if (MEM.has(key)) return MEM.get(key)
  const ls = loadLS()
  if (Object.prototype.hasOwnProperty.call(ls, key)) { MEM.set(key, ls[key]); return ls[key] }
  return undefined
}
function cacheSet(key, val) {
  MEM.set(key, val)
  const ls = loadLS(); ls[key] = val; saveLS(ls)
}

const logoUrl = ref('')
const failed = ref(false)
const triedDomain = ref(false) // have we asked the domain crawl?
const triedName = ref(false)   // have we already fallen back to the name lookup?
const triedGuess = ref(false)  // have we tried the squashed-name domain guess?
const brokenUrls = new Set()
// Bumped by every resolve(), so an answer for old props is dropped.
let run = 0

function show(url) {
  if (!url || brokenUrls.has(url)) return false
  logoUrl.value = url
  failed.value = false
  return true
}

function resolve() {
  run += 1
  logoUrl.value = ''
  failed.value = false
  triedDomain.value = false
  triedName.value = false
  triedGuess.value = false
  brokenUrls.clear()
  if (show(props.src)) return
  resolveByDomain(run)
}

async function resolveByDomain(token) {
  triedDomain.value = true
  if (props.domain) {
    const key = `d:${props.domain.toLowerCase()}`
    const cached = cacheGet(key)
    if (cached !== undefined) {
      if (show(cached)) return
    } else {
      try {
        const { data } = await promptLibrary.brandLogo(props.domain)
        const url = data?.logo || ''
        cacheSet(key, url)
        if (token !== run) return
        if (show(url)) return
      } catch {
        if (token !== run) return
        /* fall through to name lookup */
      }
    }
  }
  afterDomain(token)
}

function afterDomain(token) {
  if (!props.guess) { failed.value = true; return }
  resolveByName(props.name, token)
}

async function resolveByName(name, token) {
  triedName.value = true
  const key = `n:${String(name || '').trim().toLowerCase()}`
  if (key === 'n:') { failed.value = true; return }
  const cached = cacheGet(key)
  if (cached !== undefined) { applyResolved(cached); return }
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
    )
    const list = res.ok ? await res.json() : []
    const best = Array.isArray(list) && list.length ? list[0] : null
    const url = best?.logo || (best?.domain ? `https://logo.clearbit.com/${best.domain}` : '')
    cacheSet(key, url)
    if (token === run) applyResolved(url)
  } catch {
    cacheSet(key, '')
    if (token === run) applyResolved('')
  }
}

function applyResolved(url) {
  if (show(url)) return
  logoUrl.value = ''
  if (!triedGuess.value) { tryGuessedDomain(); return }
  failed.value = true
}

function tryGuessedDomain() {
  triedGuess.value = true
  const guess = brandDomainGuess(props.name)
  if (!show(guess ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(guess)}&sz=64` : '')) {
    failed.value = true
  }
}

function onImgError() {
  if (logoUrl.value) brokenUrls.add(logoUrl.value)
  logoUrl.value = ''
  if (!triedDomain.value) { resolveByDomain(run); return }
  if (!props.guess) { failed.value = true; return }
  if (!triedName.value) { resolveByName(props.name, run); return }
  if (!triedGuess.value) { tryGuessedDomain(); return }
  failed.value = true
}

// Without guessing, the name only picks the badge's initial and colour, so
// editing it (as onboarding does) does not look the logo up again.
watch(() => [props.src, props.domain, props.guess, props.guess ? props.name : ''], resolve, { immediate: true })
</script>

<template>
  <img
    v-if="logoUrl && !failed"
    :src="logoUrl"
    alt=""
    :width="size"
    :height="size"
    class="brand-logo-img"
    :style="{ width: size + 'px', height: size + 'px' }"
    @error="onImgError"
  />
  <span
    v-else
    class="brand-logo-badge"
    :style="{
      width: size + 'px', height: size + 'px',
      background: brandColor(name), fontSize: Math.round(size * 0.5) + 'px',
    }"
  >{{ brandInitial(name) }}</span>
</template>

<style scoped>
.brand-logo-img {
  border-radius: 5px;
  object-fit: contain;
  background: var(--muted, #f1f5f9);
  flex: 0 0 auto;
}
.brand-logo-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  color: #fff;
  font-weight: 700;
  flex: 0 0 auto;
  line-height: 1;
}
</style>
