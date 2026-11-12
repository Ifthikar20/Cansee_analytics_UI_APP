// Which colour each series wears. Charts are ink and warm grays with one
// accent: the user's own series (brand:you) is the orange, nothing else
// is. The slots are a weight ramp, so a chart always carries a legend or
// direct labels as well. Colour follows the entity, never its
// rank: ChatGPT is slot 1 on every chart, whether it is drawn first or
// alone, and a filter that removes a series never repaints the others.
//
// Entities (Dataset.entity, contract 8c):
//   engine:<key>     chatgpt claude gemini grok perplexity -> slots 1-5
//   assistant:<key>  the five engines, copilot 6, meta-ai 7; any other -> Other
//   operator:<key>   openai anthropic google apple perplexity microsoft meta bytedance -> 1-8; any other -> Other
//   brand:<key>      you -> the accent (--viz-you), the only series that wears it;
//                    b1..b5 -> 2-6; other (or any other) -> Other
//   sentiment:<key>  positive / neutral / negative -> the diverging poles and gray
//   muted            de-emphasis gray (a comparison period)
//   status:<key>     good / warning / serious / critical (only when the series means a state)
//   slot:<n>         slot n (1-8) or slot:other; for keys coloured with stableSlots()
// A dataset without an entity takes slot index + 1; a ninth series is Other,
// never a new hue.
//
// HTML marks use the token directly (`var(--viz-cat-1)`) and recolour with
// the theme on their own. Canvas marks resolve it through cssVar, which
// re-evaluates when the theme flips, so charts recolour without a reload.
import { cssVar } from '@/lib/theme'

export const SLOTS = 8
export const ENGINE_SLOT = Object.freeze({ chatgpt: 1, claude: 2, gemini: 3, grok: 4, perplexity: 5 })
export const ASSISTANT_SLOT = Object.freeze({ chatgpt: 1, claude: 2, gemini: 3, grok: 4, perplexity: 5, copilot: 6, 'meta-ai': 7 })
export const OPERATOR_SLOT = Object.freeze({
  openai: 1,
  anthropic: 2,
  google: 3,
  apple: 4,
  perplexity: 5,
  microsoft: 6,
  meta: 7,
  bytedance: 8,
})
export const YOU = '--viz-you'
export const BRAND_SLOT = Object.freeze({ b1: 2, b2: 3, b3: 4, b4: 5, b5: 6 })

const OTHER = '--viz-other'
const ENGINE_ALIASES = { gpt4: 'chatgpt', openai: 'chatgpt', anthropic: 'claude', xai: 'grok' }
const SENTIMENT = { positive: '--viz-div-pos', neutral: '--viz-div-mid', negative: '--viz-div-neg' }
const STATUS = { good: '--viz-good', warning: '--viz-warning', serious: '--viz-serious', critical: '--viz-critical' }

// Light values, used only where the stylesheet is absent (tests, SSR).
// Keep in step with assets/css/viz.css and assets/tailwind.css.
const FALLBACK = {
  '--viz-surface': '#e7e6e1',
  '--viz-ink-1': '#0b0b0b',
  '--viz-ink-2': '#5f5e58',
  '--viz-grid': '#d6d5cf',
  '--viz-axis': '#a09f98',
  '--viz-you': '#ff4a00',
  '--viz-cat-1': '#0b0b0b',
  '--viz-cat-2': '#5f5e58',
  '--viz-cat-3': '#a09f98',
  '--viz-cat-4': '#3a3936',
  '--viz-cat-5': '#84837c',
  '--viz-cat-6': '#bab9b2',
  '--viz-cat-7': '#4d4c47',
  '--viz-cat-8': '#72716a',
  '--viz-other': '#cbcac4',
  '--viz-seq-1': '#cbcac4',
  '--viz-seq-2': '#a09f98',
  '--viz-seq-3': '#72716a',
  '--viz-seq-4': '#3a3936',
  '--viz-seq-5': '#0b0b0b',
  '--viz-seq-ink-1': '#0b0b0b',
  '--viz-seq-ink-2': '#0b0b0b',
  '--viz-seq-ink-3': '#ffffff',
  '--viz-seq-ink-4': '#ffffff',
  '--viz-seq-ink-5': '#ffffff',
  '--viz-nodata': '#dcdbd5',
  '--viz-div-pos': '#0b0b0b',
  '--viz-div-mid': '#cbcac4',
  '--viz-div-neg': '#ff4a00',
  '--viz-good': '#5f5e58',
  '--viz-warning': '#0b0b0b',
  '--viz-serious': '#b83600',
  '--viz-critical': '#ff4a00',
}

/** '--viz-cat-N' for slot N (1-8); '--viz-other' past the last slot or for 'other'. */
export function slotToken(slot) {
  const n = Number(slot)
  return Number.isInteger(n) && n >= 1 && n <= SLOTS ? `--viz-cat-${n}` : OTHER
}

function fromMap(map, key) {
  return map[key] ? slotToken(map[key]) : OTHER
}

/** The token a series wears: '--viz-cat-N' | '--viz-you' | '--viz-other' | '--viz-div-*' | '--viz-good'... */
export function entityToken(entity, index = 0) {
  const raw = String(entity ?? '').trim().toLowerCase()
  const bySlot = slotToken(Number(index) + 1)
  if (!raw) return bySlot
  if (raw === 'muted' || raw === 'other') return OTHER
  const cut = raw.indexOf(':')
  const kind = cut < 0 ? raw : raw.slice(0, cut)
  const key = cut < 0 ? '' : raw.slice(cut + 1)
  switch (kind) {
    case 'engine':
      return fromMap(ENGINE_SLOT, ENGINE_ALIASES[key] || key)
    case 'assistant':
      return fromMap(ASSISTANT_SLOT, key)
    case 'operator':
      return fromMap(OPERATOR_SLOT, key)
    case 'brand':
      return key === 'you' ? YOU : fromMap(BRAND_SLOT, key)
    case 'sentiment':
      return SENTIMENT[key] || OTHER
    case 'status':
      return STATUS[key] || OTHER
    case 'slot':
      return slotToken(key)
    default:
      return bySlot
  }
}

/** A token's current value (theme-reactive through cssVar). */
export function tokenColor(token) {
  return cssVar(token, FALLBACK[token] || FALLBACK['--viz-other'])
}

/** The colour a series wears right now; recolours with the theme. */
export function colorOf(entity, index = 0) {
  return tokenColor(entityToken(entity, index))
}

/** Sequential bin 1..5 -> '--viz-seq-N' (5 is the strongest, in both modes). */
export function seqToken(bin) {
  return `--viz-seq-${clampBin(bin)}`
}

/** The ink token for text set inside a sequential bin. */
export function seqInkToken(bin) {
  return `--viz-seq-ink-${clampBin(bin)}`
}

/** The ink colour for text set inside a sequential bin. */
export function seqInk(bin) {
  return tokenColor(seqInkToken(bin))
}

function clampBin(bin) {
  const n = Math.round(Number(bin))
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1
}

/**
 * The token for dataset `index` of a normalized spec, with `drawn` series on
 * screen. `palette: "emphasis"` gives the emphasis dataset slot 1 and every
 * other dataset Other; otherwise the entity decides; one drawn series
 * without an entity is slot 1; `sequential`/`ordinal` and `diverging`
 * palettes step through their ramps by position.
 */
export function datasetToken(spec, dataset, index = 0, { drawn = null } = {}) {
  const count = drawn ?? spec?.datasets?.length ?? 1
  if (spec?.palette === 'emphasis') {
    return dataset?.key === spec.emphasis ? slotToken(1) : OTHER
  }
  if (dataset?.entity) return entityToken(dataset.entity, index)
  if (count <= 1) return slotToken(1)
  const n = spec?.datasets?.length || count
  if (spec?.palette === 'sequential' || spec?.palette === 'ordinal') {
    return seqToken(n <= 1 ? 3 : 1 + Math.round((index * 4) / (n - 1)))
  }
  if (spec?.palette === 'diverging') {
    const middle = (n - 1) / 2
    return index < middle ? SENTIMENT.negative : index > middle ? SENTIMENT.positive : SENTIMENT.neutral
  }
  return slotToken(index + 1)
}

/**
 * The token of label `index` when the labels themselves are the series
 * (donut slices): the spec's `label_entities` entry, else slot index + 1.
 */
export function labelToken(spec, index = 0) {
  const label = spec?.labels?.[index]
  const entity = label === undefined ? null : spec?.label_entities?.[label]
  return entityToken(entity, index)
}

/**
 * Stable slots for keys that have no fixed entity (domains, pages).
 * `memory` (a Map the caller keeps for the page's lifetime) remembers each
 * key's slot: a key keeps its slot across filter changes, a new key takes
 * the lowest slot no key has held, then the lowest slot no key on screen
 * holds; past eight keys on screen the rest are 'other'.
 * Returns a Map key -> slot (1-8) or 'other'; use it as `slot:<n>` entities.
 */
export function stableSlots(keys, memory = new Map()) {
  const list = [...new Set((keys || []).map((k) => String(k)))]
  const out = new Map()
  const taken = new Set()
  for (const key of list) {
    const slot = memory.get(key)
    if (typeof slot === 'number' && !taken.has(slot)) {
      out.set(key, slot)
      taken.add(slot)
    }
  }
  const remembered = new Set(memory.values())
  const firstFree = (ok) => {
    for (let n = 1; n <= SLOTS; n++) if (ok(n)) return n
    return null
  }
  for (const key of list) {
    if (out.has(key)) continue
    const slot = firstFree((n) => !taken.has(n) && !remembered.has(n)) ?? firstFree((n) => !taken.has(n))
    if (slot === null) {
      out.set(key, 'other')
      continue
    }
    for (const [k, v] of memory) if (v === slot) memory.delete(k)
    memory.set(key, slot)
    remembered.add(slot)
    taken.add(slot)
    out.set(key, slot)
  }
  return out
}

/** `color` with alpha (hex or rgb()); other formats come back unchanged. */
export function withAlpha(color, alpha) {
  const text = String(color || '').trim()
  let m = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  m = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`
  return text
}

/**
 * A CSS colour that may be `var(--token)` or `var(--token, fallback)`,
 * resolved for canvas drawing; '' resolves the chart surface.
 */
export function resolveColor(css, fallbackToken = '--viz-surface') {
  const text = String(css || '').trim()
  if (!text) return tokenColor(fallbackToken)
  const m = text.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/)
  if (!m) return text
  return cssVar(m[1], m[2]?.trim() || FALLBACK[m[1]] || tokenColor(fallbackToken))
}
