import { describe, expect, it } from 'vitest'
import { initialRunState, isPartActive, parseTabId, reduceEvent, reduceEvents } from '../reducer'
import {
    ASSISTANT_ID,
    CHAT_ID,
    SERP_CAPTURE,
    emptyAssistant,
    eventFactory,
    researchRunEvents,
} from './__fixtures__/runEvents'

function snapshot(overrides = {}) {
    return {
        message: emptyAssistant(overrides.message),
        run: initialRunState(overrides.run),
        drafts: overrides.drafts || {},
    }
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value)
        Object.values(value).forEach(deepFreeze)
    }
    return value
}

const types = (effects) => effects.map((fx) => fx.type)

describe('reduceEvents: a full research turn', () => {
    const events = researchRunEvents()
    const out = reduceEvents(snapshot(), events)

    it('builds the parts in arrival order with their final values', () => {
        expect(out.message.parts.map((p) => p.id)).toEqual(['p-think', 'p-serp', 'p-claude', 'p-grok', 'p-text'])
        const [think, serp, claude, grok, text] = out.message.parts
        expect(think).toMatchObject({ type: 'thinking', text: 'Checking Google first.', duration_ms: 2000 })
        expect(serp).toMatchObject({ status: 'done', brand_positions: [14], result_count: 3, tab_id: 'serp:cap-1' })
        expect(claude).toMatchObject({ status: 'done', mentioned: true, rank: 3 })
        expect(grok).toMatchObject({ status: 'unavailable', error: 'XAI_API_KEY is not set' })
        expect(text.text).toBe('# Turonote on Google and AI\n\nYou rank #14 on Google.')
    })

    it('finishes the message and the run', () => {
        expect(out.message.status).toBe('complete')
        expect(out.message.parts_seq).toBe(18)
        expect(out.message.duration_ms).toBe(9000)
        expect(out.message.model).toBe('claude-opus-5-5')
        expect(out.run).toMatchObject({ phase: 'done', lastSeq: 18, durationMs: 9000, stopReason: 'end_turn', outcome: 'complete' })
        expect(out.run.startedAt).toBe(Date.parse('2026-11-02T10:00:01Z'))
        expect(out.run.usage).toEqual({
            requests: 2,
            input_tokens: 1200,
            output_tokens: 300,
            cache_read_tokens: 900,
            cache_write_tokens: 100,
            web_search_requests: 0,
            cost_usd: 0.0125,
        })
    })

    it('keeps the Google capture in the message research store', () => {
        const stored = out.message.research.serp['cap-1']
        expect(stored.results).toEqual(SERP_CAPTURE.results)
        expect(stored.brand_positions).toEqual([14])
        expect(stored.query).toBe('best note app')
        expect(out.message.research.pages).toEqual({})
    })

    it('reports pane, title and terminal effects in order', () => {
        expect(types(out.effects)).toEqual(['pane.open', 'pane.update', 'chat.updated', 'terminal'])
        const [open, update, title, terminal] = out.effects
        expect(open).toMatchObject({ activate: true, tab: { id: 'serp:cap-1', kind: 'serp', status: 'loading', title: 'Google · best note app · p2' } })
        expect(open.tab.data.capture_id).toBe('cap-1')
        expect(update).toMatchObject({ tabId: 'serp:cap-1', kind: 'serp', patch: { status: 'ready' } })
        expect(update.patch.data.results).toHaveLength(3)
        expect(title).toEqual({ type: 'chat.updated', chatId: CHAT_ID, title: 'Turonote visibility' })
        expect(terminal).toEqual({ type: 'terminal', phase: 'done', status: 'complete' })
    })

    it('ignores the same events applied again', () => {
        const again = reduceEvents({ message: out.message, run: out.run, drafts: out.drafts }, events)
        expect(again.message).toBe(out.message)
        expect(again.run).toBe(out.run)
        expect(again.effects).toEqual([])
    })

    it('gives the same result when the batch is split', () => {
        let state = snapshot()
        for (const chunk of [events.slice(0, 5), events.slice(5, 11), events.slice(11)]) {
            const step = reduceEvents(state, chunk)
            state = { message: step.message, run: step.run, drafts: step.drafts }
        }
        expect(state.message).toEqual(out.message)
        expect(state.run).toEqual(out.run)
    })

    it('never mutates its inputs', () => {
        const input = deepFreeze(snapshot())
        const frozenEvents = deepFreeze(researchRunEvents())
        expect(() => reduceEvents(input, frozenEvents)).not.toThrow()
        expect(input.message.parts).toEqual([])
    })
})

describe('reduceEvent', () => {
    it('drops events at or below lastSeq', () => {
        const e = eventFactory({ start: 4 })
        const state = snapshot({ run: { lastSeq: 5 } })
        const stale = reduceEvent(state, { ...e('part.added', { part: { id: 'x', type: 'text', text: '' } }), seq: 5 })
        expect(stale.state).toBe(state)
        const fresh = reduceEvent(state, { ...e('part.added', { part: { id: 'x', type: 'text', text: '' } }), seq: 6 })
        expect(fresh.state.message.parts).toHaveLength(1)
        expect(fresh.state.run.lastSeq).toBe(6)
    })

    it('ignores unknown event types but advances lastSeq', () => {
        const out = reduceEvent(snapshot(), { v: 1, seq: 3, type: 'something.new' })
        expect(out.state.message.parts).toEqual([])
        expect(out.state.run.lastSeq).toBe(3)
        expect(out.effects).toEqual([])
    })

    it('ignores malformed input', () => {
        const state = snapshot()
        expect(reduceEvent(state, null).state).toBe(state)
        expect(reduceEvent(state, { seq: 1 }).state).toBe(state)
    })
})

describe('parts', () => {
    const e = eventFactory()
    const base = reduceEvents(snapshot(), [
        e('part.added', { part: { id: 'a', type: 'text', request: 1, text: 'Hello' } }),
        e('part.added', { part: { id: 'b', type: 'tool', request: 1, name: 'get_project_overview', label: 'Read the overview', status: 'running' } }),
    ])
    const state = { message: base.message, run: base.run, drafts: base.drafts }

    it('appends deltas to the named field and keeps other parts by identity', () => {
        const out = reduceEvent(state, e('part.delta', { part_id: 'a', field: 'text', append: ' world' }))
        expect(out.state.message.parts[0].text).toBe('Hello world')
        expect(out.state.message.parts[1]).toBe(state.message.parts[1])
    })

    it('ignores a delta for an unknown part', () => {
        const out = reduceEvent(state, e('part.delta', { part_id: 'nope', field: 'text', append: 'x' }))
        expect(out.state.message).toBe(state.message)
    })

    it('shallow-merges part.updated and keeps the id', () => {
        const out = reduceEvent(state, e('part.updated', { part_id: 'b', patch: { status: 'done', summary: '3 prompts', id: 'other' } }))
        expect(out.state.message.parts[1]).toMatchObject({ id: 'b', status: 'done', summary: '3 prompts', label: 'Read the overview' })
    })

    it('replaces a part re-added with the same id', () => {
        const out = reduceEvent(state, e('part.added', { part: { id: 'a', type: 'text', request: 1, text: 'Replaced' } }))
        expect(out.state.message.parts).toHaveLength(2)
        expect(out.state.message.parts[0].text).toBe('Replaced')
    })
})

describe('turn.reset', () => {
    it('drops the parts of that request and the drafts it started', () => {
        const e = eventFactory()
        const built = reduceEvents(snapshot(), [
            e('part.added', { part: { id: 'keep', type: 'text', request: 1, text: 'Kept' } }),
            e('part.added', { part: { id: 'call', type: 'agent_call', request: 2, agent: 'landing_page', status: 'drafting', artifact_id: 'art-1' } }),
            e('artifact.started', { artifact_id: 'art-1', kind: 'page', title: 'Battery page', agent_key: 'landing_page', base_version: null }),
            e('artifact.delta', { artifact_id: 'art-1', append: '<!DOCTYPE html>' }),
            e('part.added', { part: { id: 'drop', type: 'text', request: 2, text: 'Partial' } }),
        ])
        expect(built.drafts['art-1'].request).toBe(2)
        const out = reduceEvents({ message: built.message, run: built.run, drafts: built.drafts }, [e('turn.reset', { request: 2 })])
        expect(out.message.parts.map((p) => p.id)).toEqual(['keep'])
        expect(out.drafts).toEqual({})
        expect(out.effects).toEqual([{ type: 'artifact.reset', artifactId: 'art-1' }])
    })

    it('matches requests across number and string', () => {
        const e = eventFactory()
        const built = reduceEvents(snapshot(), [e('part.added', { part: { id: 'x', type: 'text', request: '3', text: '' } })])
        const out = reduceEvents({ message: built.message, run: built.run, drafts: built.drafts }, [e('turn.reset', { request: 3 })])
        expect(out.message.parts).toEqual([])
    })
})

describe('lifecycle', () => {
    it('keeps a requested cancel through run.started', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot({ run: { phase: 'cancelling' } }), [e('run.started', { model: 'claude-opus-5-5' })])
        expect(out.run.phase).toBe('cancelling')
        expect(out.message.status).toBe('streaming')
    })

    it('records retries and clears them on the next part event', () => {
        const e = eventFactory()
        const retrying = reduceEvents(snapshot(), [e('run.retrying', { attempt: 1, reason: 'overloaded', delay_ms: 2000 })])
        expect(retrying.run.retrying).toMatchObject({ attempt: 1, reason: 'overloaded', delayMs: 2000 })
        const resumed = reduceEvents(
            { message: retrying.message, run: retrying.run, drafts: retrying.drafts },
            [e('part.added', { part: { id: 't', type: 'text', text: '' } })]
        )
        expect(resumed.run.retrying).toBeNull()
    })

    it.each([
        ['run.failed', { error: { code: 'allowance_exceeded', message: 'Allowance used up.', retryable: false } }, 'failed', 'failed'],
        ['run.cancelled', {}, 'cancelled', 'cancelled'],
        ['run.interrupted', { reason: 'worker restarted' }, 'failed', 'interrupted'],
        ['run.completed', { status: 'truncated', stop_reason: 'max_tokens', parts_seq: 4, duration_ms: 100 }, 'done', 'truncated'],
        ['run.completed', { status: 'refused', stop_reason: 'refusal', parts_seq: 4, duration_ms: 100 }, 'done', 'refused'],
    ])('%s sets the phase and the message status', (type, payload, phase, messageStatus) => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [e(type, payload)])
        expect(out.run.phase).toBe(phase)
        expect(out.message.status).toBe(messageStatus)
        expect(out.effects).toEqual([{ type: 'terminal', phase, status: messageStatus }])
        expect(out.message.finished_at).toBeTruthy()
    })

    it('copies the failure onto the run and the message', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [e('run.failed', { error: { code: 'upstream_overloaded', message: 'Busy.', retryable: true } })])
        expect(out.run.error).toEqual({ code: 'upstream_overloaded', message: 'Busy.', retryable: true })
        expect(out.message).toMatchObject({ error_code: 'upstream_overloaded', error_message: 'Busy.' })
    })

    it('reports interrupted runs as retryable failures', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [e('run.interrupted', { reason: 'worker restarted' })])
        expect(out.run.error).toEqual({ code: 'interrupted', message: 'worker restarted', retryable: true })
    })

    it('turns resync into an effect', () => {
        const e = eventFactory()
        expect(reduceEvents(snapshot(), [e('resync', { reason: 'buffer_expired' })]).effects).toEqual([
            { type: 'resync', reason: 'buffer_expired' },
        ])
    })
})

describe('artifacts', () => {
    it('drafts a page from deltas and completes it', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [
            e('part.added', { part: { id: 'call', type: 'agent_call', request: 1, agent: 'landing_page', status: 'drafting', artifact_id: 'art-1' } }),
            e('artifact.started', { artifact_id: 'art-1', kind: 'page', title: 'Battery page', agent_key: 'landing_page', base_version: null }),
            e('artifact.delta', { artifact_id: 'art-1', append: '<!DOCTYPE html><html>' }),
            e('artifact.delta', { artifact_id: 'art-1', append: '</html>' }),
            e('artifact.completed', { artifact_id: 'art-1', version: 1, title: 'Battery landing page', summary: '5 sections', warnings: [] }),
        ])
        expect(out.drafts['art-1']).toMatchObject({
            artifactId: 'art-1',
            kind: 'page',
            agentKey: 'landing_page',
            status: 'done',
            content: '<!DOCTYPE html><html></html>',
            version: 1,
            title: 'Battery landing page',
            summary: '5 sections',
            request: 1,
        })
        expect(out.effects).toEqual([
            { type: 'artifact.started', artifactId: 'art-1', kind: 'page', title: 'Battery page' },
            { type: 'artifact.completed', artifactId: 'art-1', version: 1 },
        ])
    })

    it('keeps the latest sheet snapshot, parsing JSON text', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [
            e('artifact.started', { artifact_id: 'art-2', kind: 'sheet', title: 'Ads', agent_key: 'ad_campaign', base_version: null }),
            e('artifact.snapshot', { artifact_id: 'art-2', content: { campaign: { name: 'Draft' } } }),
            e('artifact.snapshot', { artifact_id: 'art-2', content: '{"campaign":{"name":"Notes"},"ad_groups":[]}' }),
        ])
        expect(out.drafts['art-2'].data).toEqual({ campaign: { name: 'Notes' }, ad_groups: [] })
    })

    it('marks a failed draft and reports it', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [
            e('artifact.started', { artifact_id: 'art-3', kind: 'document', title: 'Article', agent_key: 'aeo_article', base_version: 2 }),
            e('artifact.failed', { artifact_id: 'art-3', error: { code: 'insufficient_allowance', message: 'Not enough allowance.' } }),
        ])
        expect(out.drafts['art-3']).toMatchObject({ status: 'failed', baseVersion: 2, error: { code: 'insufficient_allowance', message: 'Not enough allowance.' } })
        expect(out.effects[1]).toEqual({
            type: 'artifact.failed',
            artifactId: 'art-3',
            error: { code: 'insufficient_allowance', message: 'Not enough allowance.' },
        })
    })

    it('creates a draft for a delta whose start it missed', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [e('artifact.delta', { artifact_id: 'art-4', append: '# Title' })])
        expect(out.drafts['art-4']).toMatchObject({ status: 'drafting', content: '# Title' })
    })
})

describe('browser events', () => {
    it('stores page captures under pages and infers a ready tab from its facts', () => {
        const e = eventFactory()
        const capture = {
            capture_id: 'pg-1',
            url: 'https://turonote.com/',
            final_url: 'https://turonote.com/',
            captured_at: '2026-11-02T10:00:09Z',
            frameable: true,
            status_code: 200,
            seo: { title: 'Turonote', title_length: 8 },
            reader: null,
            error: null,
        }
        const out = reduceEvents(snapshot(), [e('browser.open', { tab: { id: 'page:pg-1', kind: 'page', title: 'Turonote', data: capture }, activate: false })])
        expect(out.message.research.pages['pg-1']).toEqual(capture)
        expect(out.effects[0]).toMatchObject({ type: 'pane.open', activate: false, tab: { id: 'page:pg-1', kind: 'page', status: 'ready' } })
    })

    it('settles an updated tab from its data when the patch has no status', () => {
        const e = eventFactory()
        const opened = reduceEvents(snapshot(), [
            e('browser.open', { tab: { id: 'serp:c9', kind: 'serp', title: 'Google · q', status: 'loading', data: { capture_id: 'c9', query: 'q' } }, activate: true }),
        ])
        const state = { message: opened.message, run: opened.run, drafts: opened.drafts }
        const ready = reduceEvent(state, e('browser.update', { tab_id: 'serp:c9', patch: { results: [] } }))
        expect(ready.effects[0].patch.status).toBe('ready')
        expect(ready.effects[0].patch.data).toMatchObject({ capture_id: 'c9', query: 'q', results: [] })

        const failed = reduceEvent(state, e('browser.update', { tab_id: 'serp:c9', patch: { error: { code: 'serp_failed', message: 'SerpAPI error' } } }))
        expect(failed.effects[0].patch.status).toBe('error')

        const titled = reduceEvent(state, e('browser.update', { tab_id: 'serp:c9', patch: { title: 'Renamed' } }))
        expect(titled.effects[0].patch).not.toHaveProperty('status')
        expect(titled.effects[0].patch.title).toBe('Renamed')
    })

    it('takes the status and title sent beside the patch', () => {
        const e = eventFactory()
        const opened = reduceEvents(snapshot(), [
            e('browser.open', { tab: { id: 'page:pg-2', kind: 'page', title: 'turonote.com', status: 'loading', data: { capture_id: 'pg-2', url: 'https://turonote.com/' } }, activate: true }),
        ])
        const state = { message: opened.message, run: opened.run, drafts: opened.drafts }
        // Nothing in this data settles the tab by itself; the explicit status does.
        const capture = { capture_id: 'pg-2', url: 'https://turonote.com/', seo: null, reader: null, error: null }
        const out = reduceEvent(state, e('browser.update', { tab_id: 'page:pg-2', status: 'ready', title: 'Turonote: notes that sync', patch: capture }))
        expect(out.effects[0].patch).toMatchObject({ status: 'ready', title: 'Turonote: notes that sync' })
        expect(out.state.message.research.pages['pg-2']).not.toHaveProperty('title')
    })

    it('ignores a browser.open without a tab id', () => {
        const e = eventFactory()
        const out = reduceEvents(snapshot(), [e('browser.open', { tab: { kind: 'serp' }, activate: true })])
        expect(out.effects).toEqual([])
    })
})

describe('helpers', () => {
    it('parses tab ids', () => {
        expect(parseTabId('serp:abc')).toEqual({ kind: 'serp', captureId: 'abc' })
        expect(parseTabId('page:a:b')).toEqual({ kind: 'page', captureId: 'a:b' })
        expect(parseTabId('plain')).toEqual({ kind: '', captureId: 'plain' })
    })

    it('treats a running part as live only while the message streams', () => {
        const part = { id: 'x', type: 'tool', status: 'running' }
        expect(isPartActive(part, { id: ASSISTANT_ID, status: 'streaming' })).toBe(true)
        expect(isPartActive(part, { id: ASSISTANT_ID, status: 'cancelled' })).toBe(false)
        expect(isPartActive({ ...part, status: 'done' }, { status: 'streaming' })).toBe(false)
    })
})
