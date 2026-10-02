import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Reveals the string returned by `text()` a few characters at a time,
// restarting whenever that string changes. With `enabled()` false
// (reduced motion) it shows everything at once. The timer is cleared on
// unmount.
export function useTypewriter(text, enabled, { interval = 18, step = 2 } = {}) {
  const shown = ref(0)
  const length = () => text().length
  let timer = null

  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }
  const finish = () => {
    stop()
    shown.value = length()
  }
  const start = () => {
    stop()
    if (!enabled()) {
      shown.value = length()
      return
    }
    shown.value = 0
    timer = setInterval(() => {
      shown.value = Math.min(length(), shown.value + step)
      if (shown.value >= length()) stop()
    }, interval)
  }

  watch(text, start, { immediate: true })
  onBeforeUnmount(stop)

  return { shown, finish, done: computed(() => shown.value >= length()) }
}

// Eases a number from 0 to `target()` once on mount and again whenever
// the target changes. Shows the final value straight away when motion is
// off.
export function useCountUp(target, enabled, duration = 900) {
  const value = ref(0)
  let raf = 0

  const run = () => {
    cancelAnimationFrame(raf)
    const to = target()
    if (!enabled()) {
      value.value = to
      return
    }
    const start = performance.now()
    const frame = (t) => {
      const p = Math.min(1, (t - start) / duration)
      value.value = to * (1 - Math.pow(1 - p, 3))
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  }

  watch(target, run, { immediate: true })
  onBeforeUnmount(() => cancelAnimationFrame(raf))

  return value
}
