// Incremental text/event-stream parser following the WHATWG "event stream
// interpretation" rules: CR, LF and CRLF line ends (including a CRLF split
// across two chunks), one leading BOM, multi-line `data`, a last event id
// that persists across events, `retry` with ASCII digits only, comments,
// and no dispatch for an event whose data buffer is empty. Pending data at
// the end of the stream is discarded, as the spec requires.

const LF = 10
const CR = 13

/**
 * @param {{
 *   onEvent?: (e: {type: string, data: string, id: string}) => void,
 *   onComment?: (text: string) => void,
 *   onRetry?: (ms: number) => void,
 * }} handlers
 */
export function createSseParser({ onEvent, onComment, onRetry } = {}) {
    let buffer = ''
    let scanFrom = 0
    let started = false
    let pendingCR = false
    let data = ''
    let hasData = false
    let eventType = ''
    let lastEventId = ''

    function dispatch() {
        if (!hasData) {
            eventType = ''
            return
        }
        const type = eventType || 'message'
        const payload = data.endsWith('\n') ? data.slice(0, -1) : data
        data = ''
        hasData = false
        eventType = ''
        onEvent?.({ type, data: payload, id: lastEventId })
    }

    function field(name, value) {
        switch (name) {
            case 'event':
                eventType = value
                break
            case 'data':
                data += value + '\n'
                hasData = true
                break
            case 'id':
                if (!value.includes('\u0000')) lastEventId = value
                break
            case 'retry':
                if (/^[0-9]+$/.test(value)) onRetry?.(parseInt(value, 10))
                break
            default:
                break
        }
    }

    function line(text) {
        if (text === '') {
            dispatch()
            return
        }
        if (text.charCodeAt(0) === 58 /* : */) {
            onComment?.(text.slice(1).replace(/^ /, ''))
            return
        }
        const colon = text.indexOf(':')
        if (colon === -1) {
            field(text, '')
            return
        }
        let value = text.slice(colon + 1)
        if (value.charCodeAt(0) === 32 /* space */) value = value.slice(1)
        field(text.slice(0, colon), value)
    }

    function feed(chunk) {
        if (typeof chunk !== 'string' || chunk === '') return
        let text = chunk
        if (!started) {
            started = true
            if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
        }
        if (pendingCR) {
            pendingCR = false
            if (text.charCodeAt(0) === LF) text = text.slice(1)
        }
        if (text === '') return
        buffer += text
        let lineStart = 0
        let i = scanFrom
        while (i < buffer.length) {
            const c = buffer.charCodeAt(i)
            if (c === LF || c === CR) {
                line(buffer.slice(lineStart, i))
                if (c === CR) {
                    if (i + 1 < buffer.length) {
                        if (buffer.charCodeAt(i + 1) === LF) i += 1
                    } else {
                        pendingCR = true
                    }
                }
                lineStart = i + 1
            }
            i += 1
        }
        buffer = buffer.slice(lineStart)
        scanFrom = buffer.length
    }

    /** End of stream: an unterminated line or event is discarded. */
    function end() {
        buffer = ''
        scanFrom = 0
        pendingCR = false
        data = ''
        hasData = false
        eventType = ''
    }

    return {
        feed,
        end,
        get lastEventId() {
            return lastEventId
        },
    }
}

/** Convenience for tests and one-shot bodies: parse a whole stream. */
export function parseSse(text) {
    const events = []
    const comments = []
    const retries = []
    const parser = createSseParser({
        onEvent: (e) => events.push(e),
        onComment: (c) => comments.push(c),
        onRetry: (ms) => retries.push(ms),
    })
    parser.feed(text)
    parser.end()
    return { events, comments, retries, lastEventId: parser.lastEventId }
}
