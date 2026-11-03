import { describe, expect, it } from 'vitest'
import { agentList, writerUnavailable } from '../agentsMeta'

const usd = (n) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// GET status/ as the backend sends it (apps/agent/services/catalog.py status_for).
function status({ writers, cap = 1, spent = 0.8 } = {}) {
  return {
    enabled: true,
    allowance: { cap_usd: cap, spent_usd: spent, exceeded: false, warning: true },
    writers: writers ?? {
      landing_page: { available: false, needs_usd: 0.32 },
      aeo_article: { available: false, needs_usd: 0.32 },
      ad_campaign: { available: true, needs_usd: 0.32 },
    },
  }
}

const NEEDS = `Needs at least ${usd(0.32)} of AI allowance; ${usd(0.2)} left this month.`

describe('writerUnavailable', () => {
  it('says what a writer needs and what is left when the allowance cannot start it', () => {
    expect(writerUnavailable('landing_page', status())).toBe(NEEDS)
    expect(writerUnavailable('ad_campaign', status())).toBe('')
  })

  it('never claims a limit the status does not report', () => {
    // The orchestrator itself is not a writer; older servers send no writers.
    expect(writerUnavailable('gap_analyst', status())).toBe('')
    expect(writerUnavailable('landing_page', { enabled: true, allowance: null })).toBe('')
    expect(writerUnavailable('landing_page', null)).toBe('')
    // No cap to subtract from: the amount left is not stated.
    expect(writerUnavailable('landing_page', status({ cap: 0, spent: 0 }))).toBe(
      `Needs at least ${usd(0.32)} of AI allowance.`
    )
    expect(writerUnavailable('landing_page', status({ writers: { landing_page: { available: false } } }))).toBe(
      `Needs more AI allowance than is left; ${usd(0.2)} left this month.`
    )
  })
})

describe('agentList', () => {
  it('marks each agent with why it cannot start, in catalog order', () => {
    const catalog = [
      { key: 'gap_analyst', name: 'Gap Analyst' },
      { key: 'landing_page', name: 'Landing Page Agent' },
      { key: 'ad_campaign', name: 'Ad Campaign Agent' },
    ]
    expect(agentList(catalog, status()).map((a) => [a.key, a.unavailable])).toEqual([
      ['gap_analyst', ''],
      ['landing_page', NEEDS],
      ['ad_campaign', ''],
    ])
    expect(agentList(catalog).every((a) => a.unavailable === '')).toBe(true)
  })
})
