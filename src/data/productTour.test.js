// Consistency checks for the landing-page tour's sample data.
// Run with `npm test` (node's built-in runner, no extra dependency).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  TOUR_ACTION_KINDS,
  TOUR_DETECTORS,
  TOUR_ENGINES,
  TOUR_FACT_STATUSES,
  TOUR_PRESENCE,
  TOUR_PROMPTS,
  TOUR_SEVERITIES,
  TOUR_STEPS,
  parseSegments,
  smoothedRate,
  summarizeRuns,
  wilsonInterval,
} from './productTour.js'

const ENGINE_KEYS = TOUR_ENGINES.map((e) => e.key)
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

/* ── Formula parity with apps/llm_ranking/services/ranking_service.py ── */

test('wilsonInterval matches the backend wilson_ci', () => {
  // Reference values computed with the backend's pure-Python wilson_ci.
  const cases = [
    [15, 24, 0.42709619037907065, 0.7884086656636855],
    [23, 24, 0.7975777375115778, 0.992606734645195],
    [24, 24, 0.8620194241710247, 1.0],
    [0, 10, 0.0, 0.2775401687666166],
  ]
  for (const [s, n, lo, hi] of cases) {
    const [l, h] = wilsonInterval(s, n)
    assert.ok(close(l, lo), `low for ${s}/${n}: ${l}`)
    assert.ok(close(h, hi), `high for ${s}/${n}: ${h}`)
  }
  assert.deepEqual(wilsonInterval(0, 0), [0, 0])
})

test('smoothedRate uses the Beta(2, 8) prior', () => {
  assert.equal(smoothedRate(0, 0), 0.2)
  assert.equal(smoothedRate(15, 24), 0.5)
})

test('summarizeRuns applies the 40/30/20/10 score', () => {
  const s = summarizeRuns({
    a: { answers: 6, ranks: [3, 2, 3, 4], sentiment: { positive: 3, neutral: 1, negative: 0 } },
    b: { answers: 6, ranks: [2, 2, 1, 3, 2], sentiment: { positive: 4, neutral: 1, negative: 0 } },
    c: { answers: 6, ranks: [5, 4], sentiment: { positive: 1, neutral: 1, negative: 0 } },
    d: { answers: 6, ranks: [1, 2, 2, 3], sentiment: { positive: 3, neutral: 0, negative: 1 } },
  })
  // 17/34 smoothed -> 20 pts; avg rank 2.6 -> 20; (11*20 + 3*10)/15 -> 16.67; 4 engines -> 10.
  assert.equal(s.mentioned, 15)
  assert.equal(s.answers, 24)
  assert.ok(close(s.score.parts.mention, 20))
  assert.equal(s.score.parts.rank, 20)
  assert.ok(close(s.score.parts.sentiment, 250 / 15))
  assert.equal(s.score.parts.coverage, 10)
  assert.equal(s.score.total, 66)
})

test('summarizeRuns scores zero rank and sentiment when never mentioned', () => {
  const s = summarizeRuns({
    a: { answers: 4, ranks: [], sentiment: { positive: 0, neutral: 0, negative: 0 } },
  })
  assert.equal(s.score.parts.rank, 0)
  assert.equal(s.score.parts.sentiment, 0)
  assert.ok(close(s.score.parts.coverage, 10 / 3))
})

/* ── Segment parsing ── */

test('parseSegments splits brand markers without losing text', () => {
  const text = 'Try [[Meterlane]] or {{Linear}}, then decide.'
  const segs = parseSegments(text)
  assert.deepEqual(segs, [
    { text: 'Try ', kind: 'plain' },
    { text: 'Meterlane', kind: 'you' },
    { text: ' or ', kind: 'plain' },
    { text: 'Linear', kind: 'rival' },
    { text: ', then decide.', kind: 'plain' },
  ])
  assert.deepEqual(parseSegments('plain only'), [{ text: 'plain only', kind: 'plain' }])
})

/* ── Steps ── */

test('tour steps have unique keys and full copy', () => {
  const keys = TOUR_STEPS.map((s) => s.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const s of TOUR_STEPS) {
    for (const field of ['label', 'feature', 'title', 'caption']) {
      assert.ok(s[field], `step ${s.key} is missing ${field}`)
    }
  }
})

test('every #tour-* link on the landing page opens a real step', () => {
  const page = readFileSync(new URL('../pages/LandingPage.vue', import.meta.url), 'utf8')
  const anchors = [...page.matchAll(/#tour-([a-z]+)/g)].map((m) => m[1])
  assert.ok(anchors.length > 0, 'expected use cases to link into the tour')
  const keys = new Set(TOUR_STEPS.map((s) => s.key))
  for (const a of anchors) assert.ok(keys.has(a), `#tour-${a} has no matching step`)
})

/* ── Per-prompt invariants ── */

const ids = TOUR_PROMPTS.map((p) => p.id)
test('prompt ids are unique', () => {
  assert.equal(new Set(ids).size, ids.length)
})

for (const p of TOUR_PROMPTS) {
  test(`prompt "${p.id}" is internally consistent`, () => {
    assert.ok(p.text && p.intent && p.group, 'prompt copy')
    assert.ok(p.foundOn.length > 0, 'foundOn')

    // Runs: every engine, ranks/sentiment add up.
    assert.deepEqual(Object.keys(p.runs).sort(), [...ENGINE_KEYS].sort())
    for (const [key, r] of Object.entries(p.runs)) {
      assert.ok(r.ranks.length <= r.answers, `${key}: more mentions than answers`)
      const { positive, neutral, negative } = r.sentiment
      assert.equal(positive + neutral + negative, r.ranks.length, `${key}: sentiment total`)
      for (const rank of r.ranks) assert.ok(Number.isInteger(rank) && rank >= 1, `${key}: rank ${rank}`)
    }

    // Score stays inside the backend's caps.
    const s = summarizeRuns(p.runs)
    const { mention, rank, sentiment, coverage } = s.score.parts
    assert.ok(mention >= 0 && mention <= 40)
    assert.ok([0, 5, 10, 15, 20, 30].includes(rank))
    assert.ok(sentiment >= 0 && sentiment <= 20)
    assert.ok(coverage >= 0 && coverage <= 10)
    assert.equal(s.score.total, Math.trunc(Math.min(100, mention + rank + sentiment + coverage)))
    assert.ok(s.low <= s.rate && s.rate <= s.high)

    // Latest answers: one per engine, positions drawn from that engine's runs.
    const sourceDomains = new Set(p.sources.map((src) => src.domain))
    assert.deepEqual(Object.keys(p.answers).sort(), [...ENGINE_KEYS].sort())
    for (const [key, a] of Object.entries(p.answers)) {
      assert.ok(p.runs[key].ranks.includes(a.position), `${key}: position ${a.position} not in runs`)
      assert.ok(['positive', 'neutral', 'negative'].includes(a.sentiment))
      assert.ok(p.runs[key].sentiment[a.sentiment] > 0, `${key}: no ${a.sentiment} run`)
      assert.ok(a.capturedAt)
      const segs = parseSegments(a.text)
      assert.ok(segs.some((seg) => seg.kind === 'you'), `${key}: answer never names the brand`)
      for (const d of a.cited) {
        assert.ok(sourceDomains.has(d), `${key}: cites ${d}, which is not in sources`)
        const src = p.sources.find((x) => x.domain === d)
        assert.ok(src.citedBy.includes(key), `${d} does not list ${key} in citedBy`)
      }
    }

    // Share of voice: sums to 100, exactly one "you".
    assert.equal(p.shareOfVoice.reduce((t, x) => t + x.pct, 0), 100)
    assert.equal(p.shareOfVoice.filter((x) => x.you).length, 1)

    // Sources: ranked by share, valid engines and presence.
    let prev = Infinity
    let total = 0
    for (const src of p.sources) {
      assert.ok(src.share <= prev, `${src.domain}: sources not sorted by share`)
      prev = src.share
      total += src.share
      assert.ok(src.citedBy.length > 0)
      for (const e of src.citedBy) assert.ok(ENGINE_KEYS.includes(e), `${src.domain}: engine ${e}`)
      assert.ok(src.presence in TOUR_PRESENCE, `${src.domain}: presence ${src.presence}`)
      if (src.rank != null) assert.equal(src.presence, 'mentioned', `${src.domain}: rank without mention`)
      assert.ok(src.note)
    }
    assert.ok(total <= 100)
    assert.equal(p.sources.filter((src) => src.presence === 'own').length, 1)

    // Conversation: the engine really cites that domain.
    const conv = p.conversation
    const convSource = p.sources.find((src) => src.domain === conv.domain)
    assert.ok(convSource, 'conversation domain is not a source')
    assert.ok(convSource.citedBy.includes(conv.engine), 'conversation engine does not cite its domain')
    assert.equal(conv.brands.filter((b) => b.you).length, 1)

    // Risks: real detector codes and severities.
    assert.ok(p.risks.length > 0)
    for (const r of p.risks) {
      assert.ok(r.code in TOUR_DETECTORS, `unknown detector ${r.code}`)
      assert.ok(TOUR_SEVERITIES.includes(r.severity), `severity ${r.severity}`)
      assert.ok(ENGINE_KEYS.includes(r.engine))
      assert.ok(r.flagged)
    }

    // Alignment: valid statuses; only "missed" facts have no engines.
    assert.ok(p.alignment.score >= 0 && p.alignment.score <= 100)
    for (const f of p.alignment.facts) {
      assert.ok(f.status in TOUR_FACT_STATUSES, `fact status ${f.status}`)
      for (const e of f.engines) assert.ok(ENGINE_KEYS.includes(e))
      assert.equal(f.engines.length === 0, f.status === 'missed', `fact "${f.fact}"`)
    }

    // Actions: only the three opportunity kinds the backend builds.
    assert.ok(p.actions.length > 0)
    for (const a of p.actions) assert.ok(a.kind in TOUR_ACTION_KINDS, `action kind ${a.kind}`)

    assert.ok(p.digest.channel && p.digest.lines.length > 0)
    assert.ok(Number.isInteger(p.digest.delta))
  })
}
