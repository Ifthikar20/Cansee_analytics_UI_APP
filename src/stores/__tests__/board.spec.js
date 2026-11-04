import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }))
vi.mock('@/api/board', () => ({ default: api }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const { useBoardStore, SAVE_DEBOUNCE_MS, CONFLICT_TOAST } = await import('../board')
const { useAuthStore } = await import('@/stores/auth')

// Payloads of board_contract.md 6.
const DEFAULT_PAYLOAD = {
  saved: false,
  version: 0,
  updated_at: null,
  widgets: [
    { key: 'summary', size: 'full' },
    { key: 'prompts', size: 'full' },
    { key: 'countries', size: 'half' },
    { key: 'traffic', size: 'half' },
  ],
}
const SAVED = (version, widgets) => ({ saved: true, version, updated_at: '2026-11-04T10:12:00Z', widgets })
const CACHE_KEY = 'cs-board-v1:7:w1'

const ok = (data) => Promise.resolve({ success: true, data })
const httpError = (status, error) =>
  Object.assign(new Error(String(status)), { response: { status, data: { success: false, error } } })
const fail = (status, error) => Promise.reject(httpError(status, error))
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve: (data) => resolve({ success: true, data }), reject }
}

const keys = (store, wid = 'w1') => store.layoutOf(wid).widgets.map((w) => w.key)

let store

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  localStorage.clear()
  Object.values(api).forEach((fn) => fn.mockReset())
  Object.values(toast).forEach((fn) => fn.mockReset())
  useAuthStore().user = { id: 7 }
  store = useBoardStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('loading a board', () => {
  it('shows skeletons of the default until the saved layout answers, then caches it', async () => {
    const answer = deferred()
    api.get.mockReturnValue(answer.promise)
    const done = store.load('w1')
    expect(store.layoutOf('w1')).toMatchObject({ status: 'loading', version: 0, source: 'default' })
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])
    expect(api.get).toHaveBeenCalledWith('w1')

    answer.resolve(SAVED(3, [{ key: 'countries', size: 'full' }, { key: 'nope', size: 'full' }, { key: 'pages', size: 'third' }]))
    await done
    // Unknown keys go; a size the widget does not allow becomes its default.
    expect(store.layoutOf('w1')).toMatchObject({
      status: 'ready',
      version: 3,
      saved: true,
      source: 'server',
      widgets: [
        { key: 'countries', size: 'full' },
        { key: 'pages', size: 'half' },
      ],
    })
    expect(JSON.parse(localStorage.getItem(CACHE_KEY))).toEqual({
      widgets: [
        { key: 'countries', size: 'full' },
        { key: 'pages', size: 'half' },
      ],
      version: 3,
      saved: true,
    })
  })

  it('shows the cached layout at once and replaces it with the saved one', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ widgets: [{ key: 'traffic', size: 'third' }], version: 2, saved: true }))
    const answer = deferred()
    api.get.mockReturnValue(answer.promise)
    const done = store.load('w1')
    expect(store.layoutOf('w1')).toMatchObject({ status: 'ready', version: 2, source: 'cache' })
    expect(keys(store)).toEqual(['traffic'])
    answer.resolve(SAVED(4, [{ key: 'summary', size: 'half' }]))
    await done
    expect(keys(store)).toEqual(['summary'])
    expect(store.layoutOf('w1').version).toBe(4)
  })

  it('keeps the board in memory per project, and asks again on every load', async () => {
    api.get.mockReturnValueOnce(ok(SAVED(1, [{ key: 'pages', size: 'full' }])))
    await store.load('w1')
    const answer = deferred()
    api.get.mockReturnValueOnce(answer.promise)
    store.load('w1')
    expect(store.layoutOf('w1').status).toBe('ready')
    expect(keys(store)).toEqual(['pages'])
    answer.resolve(SAVED(1, [{ key: 'pages', size: 'full' }]))
    await vi.runAllTimersAsync()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('keeps the default, or the cached layout, when the load fails', async () => {
    api.get.mockImplementation(() => fail(500, { code: 'error', message: 'x' }))
    await store.load('w1')
    expect(store.layoutOf('w1')).toMatchObject({ status: 'error', source: 'default' })
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])

    localStorage.setItem('cs-board-v1:7:w2', JSON.stringify({ widgets: [{ key: 'products', size: 'half' }], version: 5 }))
    await store.load('w2')
    expect(store.layoutOf('w2')).toMatchObject({ status: 'error', source: 'cache', version: 5 })
    expect(keys(store, 'w2')).toEqual(['products'])

    // Try again.
    api.get.mockReturnValue(ok(SAVED(6, [{ key: 'summary', size: 'full' }])))
    await store.load('w1')
    expect(store.layoutOf('w1')).toMatchObject({ status: 'ready', source: 'server', version: 6 })
  })

  it('refuses edits while nothing is known about the board', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    store.load('w1')
    expect(store.add('w1', 'pages')).toBe(false)
    expect(store.remove('w1', 'summary')).toBe(false)
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])
  })

  it('keeps a change of ours over a load that answers after it', async () => {
    api.get.mockReturnValueOnce(ok(DEFAULT_PAYLOAD))
    await store.load('w1')
    const answer = deferred()
    api.get.mockReturnValueOnce(answer.promise)
    store.load('w1')
    store.add('w1', 'pages')
    answer.resolve(SAVED(2, [{ key: 'summary', size: 'full' }]))
    await Promise.resolve()
    await Promise.resolve()
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic', 'pages'])
    expect(store.layoutOf('w1').version).toBe(0)
  })

  it('tells whether a widget is on the board', async () => {
    api.get.mockReturnValue(ok(DEFAULT_PAYLOAD))
    await store.load('w1')
    expect(store.has('w1', 'countries')).toBe(true)
    expect(store.has('w1', 'pages')).toBe(false)
    expect(store.has('w9', 'countries')).toBe(false)
  })
})

describe('saving a board', () => {
  beforeEach(async () => {
    api.get.mockReturnValue(ok(DEFAULT_PAYLOAD))
    await store.load('w1')
  })

  it('applies an edit at once and saves it 400ms later, once for a burst', async () => {
    api.save.mockImplementation((wid, body) => ok(SAVED(body.version + 1, body.widgets)))
    expect(store.add('w1', 'ai-crawlers')).toBe(true)
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic', 'ai-crawlers'])
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).widgets.at(-1)).toEqual({ key: 'ai-crawlers', size: 'third' })
    expect(store.move('w1', 'ai-crawlers', -1)).toBe(true)
    expect(store.resize('w1', 'ai-crawlers', 'half')).toBe(true)
    expect(store.move('w1', 'summary', -1)).toBe(false)

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1)
    expect(api.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith('w1', {
      version: 0,
      widgets: [
        { key: 'summary', size: 'full' },
        { key: 'prompts', size: 'full' },
        { key: 'countries', size: 'half' },
        { key: 'ai-crawlers', size: 'half' },
        { key: 'traffic', size: 'half' },
      ],
    })
    await vi.runAllTimersAsync()
    expect(store.layoutOf('w1')).toMatchObject({ version: 1, saved: true, save: 'idle' })
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).version).toBe(1)
  })

  it('saves one at a time and sends a change made meanwhile after it, with the returned version', async () => {
    const first = deferred()
    api.save.mockReturnValueOnce(first.promise)
    store.remove('w1', 'traffic')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(store.layoutOf('w1').save).toBe('saving')

    store.remove('w1', 'countries')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS * 3)
    expect(api.save).toHaveBeenCalledTimes(1)

    api.save.mockImplementationOnce((wid, body) => ok(SAVED(body.version + 1, body.widgets)))
    first.resolve(SAVED(1, [DEFAULT_PAYLOAD.widgets[0], DEFAULT_PAYLOAD.widgets[1], DEFAULT_PAYLOAD.widgets[2]]))
    await vi.runAllTimersAsync()
    expect(api.save).toHaveBeenCalledTimes(2)
    expect(api.save.mock.calls[1][1]).toEqual({
      version: 1,
      widgets: [
        { key: 'summary', size: 'full' },
        { key: 'prompts', size: 'full' },
      ],
    })
    expect(store.layoutOf('w1')).toMatchObject({ version: 2, save: 'idle' })
    expect(keys(store)).toEqual(['summary', 'prompts'])
  })

  it('takes the latest layout on a conflict, drops the pending change and says so', async () => {
    const latest = SAVED(5, [{ key: 'products', size: 'full' }])
    const save = deferred()
    api.save.mockReturnValueOnce(save.promise)
    store.add('w1', 'pages')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    // An edit made while that save is out is dropped with it.
    store.add('w1', 'sentiment')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    save.reject(
      httpError(409, { code: 'layout_conflict', message: 'Your board changed in another window.', details: { layout: latest } }),
    )
    await vi.runAllTimersAsync()
    expect(keys(store)).toEqual(['products'])
    expect(store.layoutOf('w1')).toMatchObject({ version: 5, saved: true, save: 'idle' })
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith(CONFLICT_TOAST)
    expect(CONFLICT_TOAST).toBe('Your board changed in another window. Showing the latest version.')
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).version).toBe(5)
  })

  it('keeps the layout on screen when a save fails, and Try again sends it', async () => {
    api.save.mockImplementationOnce(() => fail(500, { code: 'error', message: 'Something went wrong.' }))
    store.remove('w1', 'summary')
    await vi.runAllTimersAsync()
    expect(store.layoutOf('w1').save).toBe('failed')
    expect(keys(store)).toEqual(['prompts', 'countries', 'traffic'])
    expect(toast.info).not.toHaveBeenCalled()

    api.save.mockImplementationOnce((wid, body) => ok(SAVED(body.version + 1, body.widgets)))
    await store.retrySave('w1')
    expect(api.save).toHaveBeenCalledTimes(2)
    expect(api.save.mock.calls[1][1]).toEqual({ version: 0, widgets: DEFAULT_PAYLOAD.widgets.slice(1) })
    expect(store.layoutOf('w1')).toMatchObject({ save: 'idle', version: 1 })
  })

  it('resets: the default at once, pending saves dropped, an in-flight save awaited, then the answered version', async () => {
    const inflight = deferred()
    api.save.mockReturnValueOnce(inflight.promise)
    store.add('w1', 'pages')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    store.add('w1', 'products')

    const answer = deferred()
    api.reset.mockReturnValueOnce(answer.promise)
    const done = store.reset('w1')
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])
    await Promise.resolve()
    expect(api.reset).not.toHaveBeenCalled()

    inflight.resolve(SAVED(1, [...DEFAULT_PAYLOAD.widgets, { key: 'pages', size: 'half' }]))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.reset).toHaveBeenCalledWith('w1')
    answer.resolve(SAVED(2, DEFAULT_PAYLOAD.widgets))
    await done
    await vi.runAllTimersAsync()
    // The products edit was pending: dropped, never sent.
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(store.layoutOf('w1')).toMatchObject({ version: 2, saved: true, save: 'idle', status: 'ready' })
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])
  })

  it('keeps the default on screen when the reset fails, and Try again saves it', async () => {
    store.add('w1', 'pages')
    await vi.advanceTimersByTimeAsync(0)
    api.reset.mockImplementationOnce(() => fail(500, { code: 'error', message: 'x' }))
    await store.reset('w1')
    expect(store.layoutOf('w1').save).toBe('failed')
    expect(keys(store)).toEqual(['summary', 'prompts', 'countries', 'traffic'])
    expect(api.save).not.toHaveBeenCalled()
    api.save.mockImplementationOnce((wid, body) => ok(SAVED(body.version + 1, body.widgets)))
    await store.retrySave('w1')
    expect(api.save.mock.calls[0][1]).toEqual({ version: 0, widgets: DEFAULT_PAYLOAD.widgets })
  })
})

describe('the browser cache', () => {
  it('is per user and project, and a corrupt entry reads as nothing', async () => {
    localStorage.setItem(CACHE_KEY, '{not json')
    localStorage.setItem('cs-board-v1:8:w1', JSON.stringify({ widgets: [{ key: 'pages', size: 'full' }], version: 1 }))
    api.get.mockReturnValue(new Promise(() => {}))
    store.load('w1')
    expect(store.layoutOf('w1')).toMatchObject({ status: 'loading', source: 'default' })
  })

  it('tolerates storage that throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    api.get.mockReturnValue(ok(SAVED(2, [{ key: 'pages', size: 'full' }])))
    api.save.mockImplementation((wid, body) => ok(SAVED(body.version + 1, body.widgets)))
    await store.load('w1')
    expect(keys(store)).toEqual(['pages'])
    expect(store.add('w1', 'products')).toBe(true)
    await vi.runAllTimersAsync()
    expect(store.layoutOf('w1')).toMatchObject({ version: 3, save: 'idle' })
  })

  it('needs a signed-in user', async () => {
    useAuthStore().user = null
    api.get.mockReturnValue(ok(SAVED(2, [{ key: 'pages', size: 'full' }])))
    await store.load('w1')
    expect(localStorage.length).toBe(0)
  })
})
