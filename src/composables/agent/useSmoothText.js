import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

// Presentational smoothing for streamed text. Deltas arrive in bursts; this
// reveals them at a steady pace per animation frame, catching up faster the
// further it falls behind, so the reply reads word by word without lagging
// the stream. Text that already exists when the hook starts shows at once.

const MIN_CPS = 90
const LIVE_WINDOW_MS = 260
const DRAIN_WINDOW_MS = 120
const MAX_FRAME_MS = 64
const WORD_REACH = 12

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

// Stop at a word boundary when one is close, so words appear whole.
function wordEnd(full, end) {
  if (end >= full.length) return full.length
  if (/\s/.test(full[end - 1] || ' ')) return end
  const limit = Math.min(full.length, end + WORD_REACH)
  for (let i = end; i < limit; i++) {
    if (/\s/.test(full[i])) return i
  }
  return end
}

/**
 * @param source    ref or getter of the full received text
 * @param streaming ref or getter, true while more text may arrive
 * @param options   { reducedMotion?: boolean }
 * @returns {{ text: Ref<string>, catchingUp: ComputedRef<boolean>, flush: () => void }}
 */
export function useSmoothText(source, streaming, options = {}) {
  const target = () => String(toValue(source) ?? '')
  const live = () => Boolean(toValue(streaming))
  const reduced = options.reducedMotion ?? prefersReducedMotion()

  const text = ref(target())
  let frame = 0
  let lastTs = 0
  let budget = 0

  function stopFrames() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    lastTs = 0
    budget = 0
  }

  function flush() {
    stopFrames()
    text.value = target()
  }

  function canAnimate() {
    if (reduced) return false
    if (typeof requestAnimationFrame !== 'function') return false
    try {
      if (document.hidden) return false
    } catch {}
    return true
  }

  function tick(ts) {
    frame = 0
    const full = target()
    let shown = text.value
    if (!full.startsWith(shown)) shown = full.slice(0, commonPrefixLength(shown, full))
    const backlog = full.length - shown.length
    if (backlog <= 0) {
      text.value = full
      lastTs = 0
      budget = 0
      return
    }
    const dt = lastTs ? Math.min(MAX_FRAME_MS, Math.max(0, ts - lastTs)) : 16
    lastTs = ts
    const window = live() ? LIVE_WINDOW_MS : DRAIN_WINDOW_MS
    const cps = Math.max(MIN_CPS, (backlog * 1000) / window)
    budget += (cps * dt) / 1000
    const step = Math.floor(budget)
    if (step >= 1) {
      budget -= step
      text.value = full.slice(0, wordEnd(full, shown.length + step))
    } else if (shown !== text.value) {
      text.value = shown
    }
    if (text.value.length < full.length) frame = requestAnimationFrame(tick)
    else {
      lastTs = 0
      budget = 0
    }
  }

  function schedule() {
    if (!canAnimate()) {
      flush()
      return
    }
    if (!frame) frame = requestAnimationFrame(tick)
  }

  watch(target, (full) => {
    // Finished text that is not mid-reveal (history, a reload) shows at once.
    if (!live() && !frame) {
      text.value = full
      return
    }
    if (!full.startsWith(text.value)) text.value = full.slice(0, commonPrefixLength(text.value, full))
    schedule()
  })

  watch(live, (isLive) => {
    if (!isLive && text.value !== target()) schedule()
  })

  onScopeDispose(stopFrames)

  const catchingUp = computed(() => text.value.length < target().length)

  return { text, catchingUp, flush }
}
