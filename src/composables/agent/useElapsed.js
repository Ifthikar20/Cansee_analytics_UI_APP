import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

// Elapsed time for "Working" / "Worked for Ns". While running it ticks once a
// second from `startedAt`; once finished it shows `finalMs` when known.

function toMs(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/** 9s, 1m 5s, 2m, 1h 4m. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/**
 * @param startedAt ref/getter: ISO string or epoch ms
 * @param running   ref/getter: boolean
 * @param finalMs   ref/getter: duration once finished (optional)
 * @param endedAt   ref/getter: ISO string or epoch ms (optional)
 */
export function useElapsed(startedAt, running, finalMs = null, endedAt = null) {
  const now = ref(Date.now())
  let timer = 0
  let localStart = null

  function stop() {
    if (timer) clearTimeout(timer)
    timer = 0
  }

  function tick() {
    now.value = Date.now()
    const start = startMs()
    // Align ticks to whole seconds of elapsed time so the label never skips.
    const elapsed = start === null ? 0 : now.value - start
    const delay = 1000 - (((elapsed % 1000) + 1000) % 1000) || 1000
    timer = setTimeout(tick, Math.min(1000, Math.max(50, delay)))
  }

  function startMs() {
    const t = toMs(toValue(startedAt))
    if (t !== null) return Math.min(t, Date.now())
    return localStart
  }

  watch(
    () => Boolean(toValue(running)),
    (isRunning) => {
      stop()
      if (isRunning) {
        if (localStart === null) localStart = Date.now()
        tick()
      } else {
        now.value = Date.now()
      }
    },
    { immediate: true }
  )

  onScopeDispose(stop)

  const ms = computed(() => {
    const isRunning = Boolean(toValue(running))
    if (!isRunning) {
      const final = toValue(finalMs)
      if (final !== null && final !== undefined && Number.isFinite(Number(final))) return Math.max(0, Number(final))
      const start = startMs()
      const end = toMs(toValue(endedAt))
      if (start !== null && end !== null) return Math.max(0, end - start)
    }
    const start = startMs()
    return start === null ? 0 : Math.max(0, now.value - start)
  })

  const label = computed(() => formatDuration(ms.value))

  return { ms, label }
}
